const PROFILE_KEY = "creator-life-profile-v1";
const ROOT_CLASS = "creator-life-onboarding";

if (localStorage.getItem(PROFILE_KEY)) {
  document.documentElement.classList.remove(ROOT_CLASS);
} else {
  document.documentElement.classList.add(ROOT_CLASS);
}

document.addEventListener("creator-life-identity-ready", () => {
  document.documentElement.classList.remove(ROOT_CLASS);
});
