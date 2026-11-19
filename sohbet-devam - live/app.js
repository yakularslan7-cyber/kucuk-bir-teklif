"use strict";

const form = document.querySelector("#contact-form");
const contact = document.querySelector("#contact");
const label = document.querySelector("#contact-label");
const hint = document.querySelector("#field-hint");
const prefix = document.querySelector("#field-prefix");
const error = document.querySelector("#form-error");
const feedback = document.querySelector("#preview-feedback");
const formView = document.querySelector("#form-view");
const stayView = document.querySelector("#stay-view");
const successView = document.querySelector("#success-view");
const submitButton = form.querySelector('button[type="submit"]');
const stayButton = document.querySelector("#stay-button");
const idleButtonContent = submitButton.innerHTML;
let selectedChannel = "instagram";
let submitting = false;
let submissionAttempted = false;
const draftValues = { instagram: "", phone: "" };

function getApiEndpoint() {
  if (window.SITE_CONFIG?.enabled !== true) return null;
  try {
    const configured = window.SITE_CONFIG.apiBaseUrl;
    if (typeof configured !== "string") return null;
    const api = new URL(configured.trim() || window.location.origin);
    const loopback = ["localhost", "127.0.0.1", "[::1]"];
    const localApi = loopback.includes(api.hostname);
    const localSite = loopback.includes(window.location.hostname);
    if (api.username || api.password || api.search || api.hash || api.pathname !== "/") return null;
    if (api.protocol !== "https:" && !(api.protocol === "http:" && localApi && localSite)) return null;
    if (localApi && !localSite) return null;
    return new URL("/api/contacts", api).href;
  } catch {
    return null;
  }
}

const apiEndpoint = getApiEndpoint();
const previewBanner = document.querySelector("#preview-banner");
if (apiEndpoint) {
  if (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
    previewBanner.textContent = "Yerel deneme · Gönderdiğin bilgiler SQL Server’a kaydedilir.";
  } else {
    previewBanner.hidden = true;
  }
}

function setSubmitting(value) {
  submitting = value;
  form.setAttribute("aria-busy", String(value));
  for (const control of form.querySelectorAll("input, button")) control.disabled = value;
  stayButton.disabled = value;
  if (value) submitButton.textContent = "Gönderiliyor…";
  else submitButton.innerHTML = idleButtonContent;
}

function clearFeedback() {
  error.hidden = true;
  error.textContent = "";
  feedback.hidden = true;
  feedback.textContent = "";
  contact.removeAttribute("aria-invalid");
}

form.addEventListener("change", (event) => {
  if (event.target.name !== "channel") return;
  draftValues[selectedChannel] = contact.value;
  selectedChannel = event.target.value;
  const isPhone = selectedChannel === "phone";
  label.textContent = isPhone ? "Telefon numaran" : "Instagram kullanıcı adın";
  contact.type = isPhone ? "tel" : "text";
  contact.inputMode = isPhone ? "tel" : "text";
  contact.autocomplete = isPhone ? "tel" : "off";
  contact.placeholder = isPhone ? "+90 5xx xxx xx xx" : "kullanici.adin";
  hint.textContent = isPhone ? "Ülke koduyla birlikte yazabilirsin." : "Sadece kullanıcı adın yeterli.";
  prefix.hidden = isPhone;
  contact.value = draftValues[selectedChannel];
  clearFeedback();
});

contact.addEventListener("input", clearFeedback);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;
  clearFeedback();
  const value = contact.value.trim();
  let message = "";
  if (!value) {
    message = selectedChannel === "instagram" ? "Instagram kullanıcı adını yazabilir misin?" : "Telefon numaranı yazabilir misin?";
  } else if (selectedChannel === "instagram" && !/^[a-zA-Z0-9._]{1,30}$/.test(value.replace(/^@/, ""))) {
    message = "Kullanıcı adını bağlantı yerine harf, rakam, nokta veya alt çizgiyle yazabilirsin.";
  } else if (selectedChannel === "phone" && (!/^\+?[0-9 ().-]+$/.test(value) || value.replace(/\D/g, "").length < 7 || value.replace(/\D/g, "").length > 15)) {
    message = "Numaranı kontrol edebilir misin? Ülke kodunu da ekleyebilirsin.";
  }
  if (message) {
    error.textContent = message;
    error.hidden = false;
    contact.setAttribute("aria-invalid", "true");
    contact.focus();
    return;
  }
  if (!apiEndpoint) {
    feedback.textContent = "Bilgi gönderilmedi. Bu bir tasarım ön izlemesi; gönderim bağlantısı henüz açık değil.";
    feedback.hidden = false;
    return;
  }

  setSubmitting(true);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    submissionAttempted = true;
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify({ channel: selectedChannel, contactValue: value }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (response.status !== 201 || result?.ok !== true) {
      const messages = {
        400: "Paylaştığın bilgiyi kontrol edip tekrar deneyebilir misin?",
        413: "Yazdığın bilgi çok uzun. Kontrol edip tekrar deneyebilir misin?",
        429: "Biraz hızlı oldu 🙂 Birkaç dakika sonra tekrar deneyebilirsin.",
        503: "Kaydın tamamlandığını doğrulayamadık. Biraz sonra tekrar deneyebilirsin.",
      };
      error.textContent = messages[response.status] || "Gönderimin sonucunu doğrulayamadık. Biraz sonra tekrar deneyebilirsin.";
      error.hidden = false;
      return;
    }
    contact.value = "";
    draftValues.instagram = "";
    draftValues.phone = "";
    formView.hidden = true;
    successView.hidden = false;
    document.querySelector("#success-heading").focus({ preventScroll: true });
  } catch {
    error.textContent = "Bağlantı kesildi; bilginin ulaşıp ulaşmadığını doğrulayamadık. Biraz sonra tekrar deneyebilirsin.";
    error.hidden = false;
  } finally {
    clearTimeout(timeout);
    setSubmitting(false);
  }
});

stayButton.addEventListener("click", () => {
  if (submitting) return;
  clearFeedback();
  contact.value = "";
  draftValues.instagram = "";
  draftValues.phone = "";
  formView.hidden = true;
  stayView.hidden = false;
  stayView.querySelector(".stay-detail").textContent = submissionAttempted
    ? "Sohbete TikTok’tan devam edebiliriz."
    : "Herhangi bir bilgi göndermedin.";
  document.querySelector("#stay-heading").focus({ preventScroll: true });
});

document.querySelector("#back-button").addEventListener("click", () => {
  stayView.hidden = true;
  formView.hidden = false;
  form.querySelector('input[name="channel"]:checked').focus({ preventScroll: true });
});
