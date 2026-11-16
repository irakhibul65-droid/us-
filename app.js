const pages = [...document.querySelectorAll(".page")];
document.body.dataset.section = pages[0].id;
const progress = document.querySelector(".progress-track");
const progressFill = document.querySelector(".progress-fill");
const footerCaption = document.querySelector("#footer-caption");
const floatingDecor = document.querySelector(".floating-decor");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pageTitles = ["Only Us ❤️", "A Special Gift For You", "A Garden For You", "Our little story", "Our Beautiful Memories ❤️", "A Song For You", "Listen to Something Special", "Reasons I love you", "A Few Questions, Just for Us ❤️", "A Letter From My Heart ❤️", "Always, Salema"];
const pageCaptions = [
  "a little love, just for you",
  "a gift made with love",
  "a little love, in full bloom",
  "the little things that mean a lot",
  "our beautiful memories",
  "a song for your heart",
  "a voice note, just for you",
  "a few reasons (of many)",
  "a few questions, just for us",
  "a letter from my heart",
  "always, and especially today"
];

const authDialog = document.querySelector("#auth-dialog");
const authForm = document.querySelector("#auth-form");
const authEmailInput = document.querySelector("#auth-email");
const authPasswordInput = document.querySelector("#auth-password");
const authSubmitButton = document.querySelector("#auth-submit");
const authStatus = document.querySelector("#auth-status");
const authOpenButton = document.querySelector("#auth-open-button");
const authSessionLabel = document.querySelector("#auth-session-label");
const logoutButton = document.querySelector("#logout-button");
let firebaseServices = null;
let firebaseInitState = "loading";
let authReady = false;
let currentUser = null;
let authorizedUserUid = "";
let pendingPageId = "";
let navigationAttempt = 0;
let authBusy = false;
let authChecking = false;

function setAuthStatus(message) {
  authStatus.textContent = message;
}

function getFirebaseUnavailableMessage() {
  if (firebaseInitState === "loading") return "Connecting securely to Firebase…";
  if (firebaseInitState === "error") return "Firebase could not initialize. Check the project configuration and network, then reload.";
  return "Firebase is not ready. Add the project configuration before opening private sections.";
}

function updateAuthControls() {
  const signedIn = Boolean(currentUser);
  const authorized = signedIn && authorizedUserUid === currentUser.uid;
  authOpenButton.hidden = authorized;
  authOpenButton.textContent = signedIn ? "Try another account" : "Sign in";
  authSessionLabel.hidden = !signedIn;
  logoutButton.hidden = !signedIn;
  logoutButton.disabled = authBusy || authChecking;
  authSessionLabel.textContent = currentUser?.email || "Signed in";
  authSubmitButton.disabled = !firebaseServices || authBusy || authChecking;
}

function openAuthDialog(message) {
  setAuthStatus(message);
  if (!authDialog.open) authDialog.showModal();
  updateAuthControls();
}

function cancelAuthDialog() {
  pendingPageId = "";
  navigationAttempt += 1;
  authChecking = false;
  if (authDialog.open) authDialog.close();
  updateAuthControls();
}

function activatePage(id) {
  const index = pages.findIndex((page) => page.id === id);
  document.body.dataset.section = id;
  pages.forEach((page, pageIndex) => {
    const active = pageIndex === index;
    page.hidden = !active;
    page.classList.toggle("is-active", active);
    if (active) page.scrollTop = 0;
  });
  progressFill.style.width = `${((index + 1) / pages.length) * 100}%`;
  progress.setAttribute("aria-valuenow", String(index + 1));
  footerCaption.textContent = pageCaptions[index];
  document.title = pageTitles[index];
  if (id === "roses") createRosePetals();
  if (id === "gallery") loadPrivateGalleryPhotos();
  if (id === "voice-note") loadPrivateVoiceNote();
  if (id === "letter") startLetterTyping();
  else stopLetterTyping();
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

async function showPage(id) {
  const index = pages.findIndex((page) => page.id === id);
  if (index < 0) return;

  if (id === "home") {
    pendingPageId = "";
    navigationAttempt += 1;
    authChecking = false;
    if (authDialog.open) authDialog.close();
    updateAuthControls();
    activatePage(id);
    return;
  }

  pendingPageId = id;
  if (firebaseInitState !== "ready") {
    activatePage("home");
    openAuthDialog(getFirebaseUnavailableMessage());
    return;
  }
  if (!authReady) {
    activatePage("home");
    openAuthDialog("Checking your sign-in status…");
    return;
  }
  if (!currentUser) {
    activatePage("home");
    openAuthDialog("Sign in with one of the two authorized accounts to continue.");
    return;
  }

  const requestId = ++navigationAttempt;
  const user = currentUser;
  authChecking = true;
  openAuthDialog("Verifying your account with Firebase…");
  try {
    await user.getIdToken(true);
    await firebaseServices.firestoreSdk.getDoc(
      firebaseServices.firestoreSdk.doc(firebaseServices.firestore, "private", user.uid)
    );
    if (requestId !== navigationAttempt || currentUser?.uid !== user.uid) return;
    authorizedUserUid = user.uid;
    pendingPageId = "";
    updateVoiceButtons();
    if (authDialog.open) authDialog.close();
    activatePage(id);
  } catch (error) {
    if (requestId !== navigationAttempt || currentUser?.uid !== user.uid) return;
    console.error("Firebase could not verify access to a protected section.", error);
    authorizedUserUid = "";
    clearPrivateContent();
    activatePage("home");
    openAuthDialog(error?.code === "permission-denied"
      ? "This account is not one of the two authorized users. Sign in with an approved account."
      : "Private access could not be verified. Check your connection and Firebase rules, then try again.");
  } finally {
    if (requestId === navigationAttempt) {
      authChecking = false;
      updateAuthControls();
    }
  }
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-go]");
  if (nav) {
    event.preventDefault();
    showPage(nav.dataset.go);
  }
});

authOpenButton.addEventListener("click", () => {
  pendingPageId = "gift";
  openAuthDialog(firebaseInitState === "ready"
    ? "Sign in with one of the two authorized accounts to continue."
    : getFirebaseUnavailableMessage());
});
document.querySelector("#auth-cancel").addEventListener("click", cancelAuthDialog);
authDialog.addEventListener("cancel", cancelAuthDialog);
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebaseServices || authBusy) return;
  authBusy = true;
  setAuthStatus("Signing in securely…");
  updateAuthControls();
  try {
    const credential = await firebaseServices.authSdk.signInWithEmailAndPassword(
      firebaseServices.auth,
      authEmailInput.value.trim(),
      authPasswordInput.value
    );
    authPasswordInput.value = "";
    pendingPageId = pendingPageId || "gift";
    if (currentUser?.uid !== credential.user.uid) handleFirebaseAuthState(credential.user);
    else if (pendingPageId) showPage(pendingPageId);
  } catch (error) {
    console.error("Firebase Authentication could not sign in the user.", error);
    const messages = {
      "auth/invalid-credential": "That email and password combination could not be verified.",
      "auth/invalid-email": "Enter a valid email address and try again.",
      "auth/user-disabled": "This account is disabled. Contact the Firebase project owner.",
      "auth/too-many-requests": "Too many sign-in attempts. Wait a little and try again.",
      "auth/network-request-failed": "Firebase sign-in could not reach the network. Check your connection.",
      "auth/operation-not-allowed": "Email and Password sign-in is not enabled for this Firebase project.",
      "auth/invalid-api-key": "Firebase rejected the web app configuration. Check its project settings."
    };
    setAuthStatus(messages[error?.code] || "Sign-in failed. Check your email, password, and Firebase setup.");
  } finally {
    authBusy = false;
    updateAuthControls();
  }
});
logoutButton.addEventListener("click", async () => {
  if (!firebaseServices) return;
  pendingPageId = "";
  authorizedUserUid = "";
  navigationAttempt += 1;
  authChecking = false;
  clearPrivateContent();
  activatePage("home");
  if (authDialog.open) authDialog.close();
  updateAuthControls();
  logoutButton.disabled = true;
  try {
    await firebaseServices.authSdk.signOut(firebaseServices.auth);
  } catch (error) {
    console.error("Firebase Authentication could not sign out the user.", error);
    openAuthDialog("Sign-out failed. Check your connection and try again.");
  } finally {
    logoutButton.disabled = false;
  }
});

const giftPage = document.querySelector("#gift");
const giftTrigger = document.querySelector("#gift-trigger");
const giftMessage = document.querySelector("#gift-message");
let giftRevealTimer = 0;
giftTrigger.addEventListener("click", () => {
  if (giftPage.classList.contains("is-open")) return;
  giftPage.classList.add("is-open");
  giftTrigger.setAttribute("aria-expanded", "true");
  giftTrigger.setAttribute("aria-label", "The pink gift is open");
  giftRevealTimer = window.setTimeout(() => {
    giftMessage.hidden = false;
    giftRevealTimer = 0;
  }, reducedMotion ? 0 : 450);
});

function createRosePetals() {
  const layer = document.querySelector(".rose-petal-layer");
  layer.replaceChildren();
  for (let index = 0; index < 16; index += 1) {
    const petal = document.createElement("span");
    petal.className = "rose-petal";
    petal.style.setProperty("--left", `${Math.random() * 100}%`);
    petal.style.setProperty("--duration", `${9 + Math.random() * 9}s`);
    petal.style.setProperty("--delay", `${-Math.random() * 16}s`);
    petal.style.setProperty("--drift", `${Math.round(Math.random() * 150 - 75)}px`);
    layer.append(petal);
  }
}

const photoButtons = [...document.querySelectorAll(".photo-open")];
const photoLightbox = document.querySelector("#photo-lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxCaption = document.querySelector("#lightbox-caption");
const lightboxCounter = document.querySelector("#lightbox-counter");
const galleryStatus = document.querySelector("#gallery-status");
let activePhotoIndex = 0;
let galleryLoadGeneration = 0;
const galleryPhotoUrls = new Map();
const maxPrivatePhotoBytes = 15 * 1024 * 1024;

function clearPrivateGalleryPhotos() {
  galleryLoadGeneration += 1;
  if (photoLightbox.open) photoLightbox.close();
  lightboxImage.removeAttribute("src");
  photoButtons.forEach((button) => {
    button.disabled = true;
    button.querySelector("img").removeAttribute("src");
  });
  galleryPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
  galleryPhotoUrls.clear();
  galleryStatus.textContent = "Sign in to load your private photos.";
}

async function loadPrivateGalleryPhotos() {
  const userId = currentUser?.uid;
  if (!firebaseServices || !userId || authorizedUserUid !== userId) return;
  if (photoButtons.every((button) => galleryPhotoUrls.has(button.querySelector("img")))) {
    galleryStatus.textContent = "Your private photos are ready.";
    return;
  }

  const loadGeneration = ++galleryLoadGeneration;
  let failedCount = 0;
  galleryStatus.textContent = "Loading your private photos…";
  await Promise.all(photoButtons.map(async (button) => {
    const image = button.querySelector("img");
    if (galleryPhotoUrls.has(image)) {
      button.disabled = false;
      return;
    }
    let imageUrl = "";
    try {
      const reference = firebaseServices.storageSdk.ref(firebaseServices.storage, image.dataset.storagePath);
      const metadata = await firebaseServices.storageSdk.getMetadata(reference);
      if (loadGeneration !== galleryLoadGeneration || authorizedUserUid !== userId) return;
      if (!metadata.contentType?.match(/^image\/(jpeg|png|webp)$/)) {
        throw new Error(`Unsupported private photo type at ${image.dataset.storagePath}.`);
      }
      const bytes = await firebaseServices.storageSdk.getBytes(reference, maxPrivatePhotoBytes);
      if (loadGeneration !== galleryLoadGeneration || authorizedUserUid !== userId) return;
      imageUrl = URL.createObjectURL(new Blob([bytes], { type: metadata.contentType }));
      image.src = imageUrl;
      await image.decode();
      if (loadGeneration !== galleryLoadGeneration || authorizedUserUid !== userId) {
        URL.revokeObjectURL(imageUrl);
        image.removeAttribute("src");
        return;
      }
      galleryPhotoUrls.set(image, imageUrl);
      imageUrl = "";
      button.disabled = false;
    } catch (error) {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      image.removeAttribute("src");
      if (loadGeneration !== galleryLoadGeneration || authorizedUserUid !== userId) return;
      failedCount += 1;
      const url = galleryPhotoUrls.get(image);
      if (url) {
        URL.revokeObjectURL(url);
        galleryPhotoUrls.delete(image);
      }
      console.error(`Could not load private photo ${image.dataset.storagePath}.`, error);
    }
  }));
  if (loadGeneration !== galleryLoadGeneration) return;
  galleryStatus.textContent = failedCount
    ? `${failedCount} private photo${failedCount === 1 ? "" : "s"} could not load. Check their Storage paths and access rules.`
    : "Your private photos are ready.";
}

function showLightboxPhoto(index) {
  activePhotoIndex = (index + photoButtons.length) % photoButtons.length;
  const photoButton = photoButtons[activePhotoIndex];
  const image = photoButton.querySelector("img");
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = photoButton.dataset.caption;
  lightboxCounter.textContent = `${activePhotoIndex + 1} / ${photoButtons.length}`;
}

photoButtons.forEach((photoButton, index) => {
  photoButton.addEventListener("click", () => {
    showLightboxPhoto(index);
    photoLightbox.showModal();
  });
});
document.querySelector(".lightbox-close").addEventListener("click", () => photoLightbox.close());
document.querySelector(".lightbox-previous").addEventListener("click", () => showLightboxPhoto(activePhotoIndex - 1));
document.querySelector(".lightbox-next").addEventListener("click", () => showLightboxPhoto(activePhotoIndex + 1));
photoLightbox.addEventListener("click", (event) => {
  if (event.target === photoLightbox) photoLightbox.close();
});
photoLightbox.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    photoLightbox.close();
  }
});
photoLightbox.addEventListener("close", () => {
  if (!photoButtons[activePhotoIndex].disabled) photoButtons[activePhotoIndex].focus();
});

const letterLines = [...document.querySelectorAll(".letter-line")];
const letterLineText = letterLines.map((line) => line.textContent.trim());
const letterLineCharacters = letterLineText.map((text) => Array.from(text));
const letterSignoff = document.querySelector("#letter-signoff");
const revealLetterButton = document.querySelector("#reveal-letter");
let letterTypingTimer = 0;

letterLines.forEach((line, index) => {
  line.setAttribute("aria-label", letterLineText[index]);
  line.textContent = "";
});

function finishLetter() {
  if (letterTypingTimer) window.clearTimeout(letterTypingTimer);
  letterTypingTimer = 0;
  letterLines.forEach((line, index) => {
    line.textContent = letterLineText[index];
    line.classList.remove("is-typing");
  });
  letterSignoff.hidden = false;
  revealLetterButton.hidden = true;
}

function stopLetterTyping() {
  if (!letterTypingTimer) return;
  window.clearTimeout(letterTypingTimer);
  letterTypingTimer = 0;
}

function startLetterTyping() {
  stopLetterTyping();
  letterLines.forEach((line) => {
    line.textContent = "";
    line.classList.remove("is-typing");
  });
  letterSignoff.hidden = true;
  revealLetterButton.hidden = false;
  if (reducedMotion) {
    finishLetter();
    return;
  }

  let lineIndex = 0;
  let characterIndex = 0;
  function typeNextCharacter() {
    while (lineIndex < letterLines.length && characterIndex >= letterLineCharacters[lineIndex].length) {
      letterLines[lineIndex].classList.remove("is-typing");
      lineIndex += 1;
      characterIndex = 0;
    }
    if (lineIndex >= letterLines.length) {
      finishLetter();
      return;
    }

    const line = letterLines[lineIndex];
    const character = letterLineCharacters[lineIndex][characterIndex];
    line.classList.add("is-typing");
    line.textContent += character;
    characterIndex += 1;
    const delay = /[,.!?]/.test(character) ? 95 : 22;
    letterTypingTimer = window.setTimeout(typeNextCharacter, delay);
  }
  typeNextCharacter();
}

revealLetterButton.addEventListener("click", finishLetter);

const musicPlayer = document.querySelector("#music-player");
const audioPlayer = document.querySelector("#audio-player");
const songFileInput = document.querySelector("#song-file");
const playButton = document.querySelector("#play-button");
const trackTitleInput = document.querySelector("#track-title");
const trackArtistInput = document.querySelector("#track-artist");
const seekSlider = document.querySelector("#seek-slider");
const currentTimeLabel = document.querySelector("#current-time");
const durationTimeLabel = document.querySelector("#duration-time");
const audioStatus = document.querySelector("#audio-status");
const volumeSlider = document.querySelector("#volume-slider");
let selectedAudioUrl = "";

audioPlayer.volume = Number(volumeSlider.value);
volumeSlider.style.setProperty("--played", `${Number(volumeSlider.value) * 100}%`);

function setAudioStatus(message) {
  audioStatus.textContent = message;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function updatePlaybackState() {
  const isPlaying = !audioPlayer.paused && !audioPlayer.ended;
  musicPlayer.classList.toggle("is-playing", isPlaying);
  playButton.setAttribute("aria-label", isPlaying ? "Pause song" : "Play song");
}

function updatePlaybackTime() {
  currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
  if (Number.isFinite(audioPlayer.duration)) {
    seekSlider.max = String(audioPlayer.duration);
    seekSlider.value = String(audioPlayer.currentTime);
    seekSlider.style.setProperty("--played", `${audioPlayer.duration ? (audioPlayer.currentTime / audioPlayer.duration) * 100 : 0}%`);
    durationTimeLabel.textContent = formatTime(audioPlayer.duration);
  }
}

songFileInput.addEventListener("change", () => {
  const file = songFileInput.files?.[0];
  if (!file) return;
  if (!/\.mp3$/i.test(file.name)) {
    songFileInput.value = "";
    setAudioStatus("Please choose an MP3 file. Your currently selected song has not changed.");
    return;
  }
  if (file.size === 0) {
    songFileInput.value = "";
    setAudioStatus("That MP3 is empty. Choose a file with audio in it; your current song has not changed.");
    return;
  }

  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
  if (selectedAudioUrl) URL.revokeObjectURL(selectedAudioUrl);
  selectedAudioUrl = URL.createObjectURL(file);
  audioPlayer.src = selectedAudioUrl;
  audioPlayer.load();
  trackTitleInput.value = file.name.replace(/\.mp3$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "Untitled song";
  seekSlider.value = "0";
  seekSlider.max = "0";
  seekSlider.style.setProperty("--played", "0%");
  seekSlider.disabled = false;
  currentTimeLabel.textContent = "0:00";
  durationTimeLabel.textContent = "0:00";
  playButton.disabled = false;
  updatePlaybackState();
  setAudioStatus("Ready when you are. Press play to start your song.");
});

playButton.addEventListener("click", async () => {
  if (!selectedAudioUrl) return;
  if (!audioPlayer.paused) {
    audioPlayer.pause();
    return;
  }

  try {
    await audioPlayer.play();
  } catch (error) {
    console.error("Could not start the selected MP3.", error);
    setAudioStatus(error.name === "NotAllowedError"
      ? "Your browser blocked playback. Press play again to allow the song."
      : "This MP3 could not be played. Try another legally obtained audio file.");
  }
});

audioPlayer.addEventListener("play", () => {
  updatePlaybackState();
  setAudioStatus("Playing just for you.");
});
audioPlayer.addEventListener("pause", () => {
  updatePlaybackState();
  if (selectedAudioUrl && !audioPlayer.ended) setAudioStatus("Paused. Press play whenever you’re ready.");
});
audioPlayer.addEventListener("ended", () => {
  updatePlaybackState();
  updatePlaybackTime();
  setAudioStatus("That was your song. Press play to hear it again.");
});
audioPlayer.addEventListener("loadedmetadata", updatePlaybackTime);
audioPlayer.addEventListener("durationchange", updatePlaybackTime);
audioPlayer.addEventListener("timeupdate", updatePlaybackTime);
audioPlayer.addEventListener("error", () => {
  if (!selectedAudioUrl) return;
  console.error("The selected MP3 could not be loaded.", audioPlayer.error);
  setAudioStatus("The selected MP3 could not be loaded. Please choose another file.");
});
seekSlider.addEventListener("input", () => {
  if (Number.isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = Number(seekSlider.value);
    updatePlaybackTime();
  }
});
volumeSlider.addEventListener("input", () => {
  audioPlayer.volume = Number(volumeSlider.value);
  volumeSlider.style.setProperty("--played", `${Number(volumeSlider.value) * 100}%`);
});
window.addEventListener("pagehide", () => {
  if (selectedAudioUrl) URL.revokeObjectURL(selectedAudioUrl);
}, { once: true });

const voicePlayer = document.querySelector("#voice-player");
const voiceAudio = document.querySelector("#voice-audio");
const voiceFileInput = document.querySelector("#voice-file");
const voiceFileName = document.querySelector("#voice-file-name");
const voiceUploadButton = document.querySelector("#voice-upload");
const voicePlayButton = document.querySelector("#voice-play");
const voiceSeek = document.querySelector("#voice-seek");
const voiceCurrentTime = document.querySelector("#voice-current-time");
const voiceDuration = document.querySelector("#voice-duration");
const voiceStatus = document.querySelector("#voice-status");
const voiceNotePath = "voice-notes/private/voice-note";
const maxVoiceNoteBytes = 25 * 1024 * 1024;
let voiceSelectedFile = null;
let voiceObjectUrl = "";
let voiceUploading = false;
let voiceUploadTask = null;
let voiceLoadGeneration = 0;

function setVoiceStatus(message) {
  voiceStatus.textContent = message;
}

function updateVoiceButtons() {
  const authorized = Boolean(currentUser && authorizedUserUid === currentUser.uid);
  voiceFileInput.disabled = !authorized || voiceUploading;
  voiceUploadButton.disabled = !authorized || !voiceSelectedFile || voiceUploading;
}

function clearVoiceAudio() {
  const previousUrl = voiceObjectUrl;
  voiceObjectUrl = "";
  voiceAudio.pause();
  voiceAudio.removeAttribute("src");
  voiceAudio.load();
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  voicePlayer.classList.remove("is-playing");
  voicePlayButton.disabled = true;
  voicePlayButton.setAttribute("aria-label", "Play voice note");
  voiceSeek.disabled = true;
  voiceSeek.value = "0";
  voiceSeek.max = "0";
  voiceSeek.style.setProperty("--played", "0%");
  voiceCurrentTime.textContent = "0:00";
  voiceDuration.textContent = "0:00";
}

function clearPrivateContent() {
  if (voiceUploadTask) voiceUploadTask.cancel();
  voiceUploadTask = null;
  voiceUploading = false;
  clearPrivateGalleryPhotos();
  clearVoiceAudio();
  voiceSelectedFile = null;
  voiceFileInput.value = "";
  voiceFileName.textContent = "No audio selected";
  setVoiceStatus("Sign in to access your private voice note.");
  updateVoiceButtons();
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
  if (selectedAudioUrl) URL.revokeObjectURL(selectedAudioUrl);
  selectedAudioUrl = "";
  songFileInput.value = "";
  trackTitleInput.value = "Choose a song";
  trackArtistInput.value = "A song for Salema";
  seekSlider.value = "0";
  seekSlider.max = "0";
  seekSlider.disabled = true;
  seekSlider.style.setProperty("--played", "0%");
  currentTimeLabel.textContent = "0:00";
  durationTimeLabel.textContent = "0:00";
  playButton.disabled = true;
  updatePlaybackState();
  setAudioStatus("Your MP3 stays on this device. Choose a song to begin.");
}

function voiceErrorMessage(error) {
  if (error?.code === "storage/unauthorized") {
    return "Access was denied. Confirm this account’s UID is listed in storage.rules and the rules are deployed.";
  }
  if (error?.code === "storage/object-not-found") {
    return "No private voice note has been uploaded yet. Choose a recording and upload it.";
  }
  if (error?.code === "storage/retry-limit-exceeded" || error?.code === "storage/network-request-failed") {
    return "The connection interrupted the private audio request. Check your connection and try again.";
  }
  return "The private voice note could not be accessed. Check the Firebase setup and try again.";
}

async function loadPrivateVoiceNote() {
  const loadGeneration = ++voiceLoadGeneration;
  const userId = currentUser?.uid;
  if (!userId || authorizedUserUid !== userId) return;
  clearVoiceAudio();
  setVoiceStatus("Checking for your private voice note…");
  try {
    const reference = firebaseServices.storageSdk.ref(firebaseServices.storage, voiceNotePath);
    const metadata = await firebaseServices.storageSdk.getMetadata(reference);
    if (loadGeneration !== voiceLoadGeneration || currentUser?.uid !== userId || authorizedUserUid !== userId) return;
    if (!metadata.contentType?.startsWith("audio/")) {
      throw new Error("The stored object is not an audio file.");
    }
    const bytes = await firebaseServices.storageSdk.getBytes(reference, maxVoiceNoteBytes);
    if (loadGeneration !== voiceLoadGeneration || currentUser?.uid !== userId || authorizedUserUid !== userId) return;
    voiceObjectUrl = URL.createObjectURL(new Blob([bytes], { type: metadata.contentType }));
    voiceAudio.src = voiceObjectUrl;
    voiceAudio.load();
    setVoiceStatus("Your private recording is ready. Press play whenever you’re ready.");
  } catch (error) {
    if (loadGeneration !== voiceLoadGeneration || currentUser?.uid !== userId || authorizedUserUid !== userId) return;
    if (error?.code !== "storage/object-not-found") console.error("Could not load the private voice note.", error);
    setVoiceStatus(voiceErrorMessage(error));
  }
}

voiceFileInput.addEventListener("change", () => {
  const file = voiceFileInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    voiceFileInput.value = "";
    voiceSelectedFile = null;
    voiceFileName.textContent = "No audio selected";
    updateVoiceButtons();
    setVoiceStatus("Please choose an audio recording. Video and other file types are not accepted.");
    return;
  }
  if (file.size === 0) {
    voiceFileInput.value = "";
    voiceSelectedFile = null;
    voiceFileName.textContent = "No audio selected";
    updateVoiceButtons();
    setVoiceStatus("That audio file is empty. Choose a recording with audio in it.");
    return;
  }
  if (file.size > maxVoiceNoteBytes) {
    voiceFileInput.value = "";
    voiceSelectedFile = null;
    voiceFileName.textContent = "No audio selected";
    updateVoiceButtons();
    setVoiceStatus("This recording is larger than 25 MB. Choose a smaller audio file.");
    return;
  }
  voiceSelectedFile = file;
  voiceFileName.textContent = file.name;
  updateVoiceButtons();
  setVoiceStatus("Ready to upload privately to Firebase Storage.");
});

voiceUploadButton.addEventListener("click", async () => {
  if (!firebaseServices || !currentUser || authorizedUserUid !== currentUser.uid || !voiceSelectedFile || voiceUploading) return;
  const userId = currentUser.uid;
  voiceUploading = true;
  updateVoiceButtons();
  updateAuthControls();
  setVoiceStatus("Starting private upload…");
  try {
    const reference = firebaseServices.storageSdk.ref(firebaseServices.storage, voiceNotePath);
    voiceUploadTask = firebaseServices.storageSdk.uploadBytesResumable(reference, voiceSelectedFile, {
      contentType: voiceSelectedFile.type
    });
    await new Promise((resolve, reject) => {
      voiceUploadTask.on("state_changed", (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setVoiceStatus(`Uploading privately… ${percent}%`);
      }, reject, resolve);
    });
    if (currentUser?.uid !== userId || authorizedUserUid !== userId) return;
    voiceUploadTask = null;
    voiceSelectedFile = null;
    voiceFileInput.value = "";
    voiceFileName.textContent = "No audio selected";
    setVoiceStatus("Upload complete. Loading your private voice note…");
    await loadPrivateVoiceNote();
  } catch (error) {
    if (currentUser?.uid === userId && authorizedUserUid === userId) {
      console.error("Could not upload the private voice note.", error);
      setVoiceStatus(voiceErrorMessage(error));
    } else if (error?.code !== "storage/canceled") {
      console.error("A private voice-note upload continued after access changed.", error);
    }
  } finally {
    if (currentUser?.uid === userId) {
      voiceUploading = false;
      voiceUploadTask = null;
      updateVoiceButtons();
      updateAuthControls();
    }
  }
});

voicePlayButton.addEventListener("click", async () => {
  if (!voiceObjectUrl) return;
  if (!voiceAudio.paused) {
    voiceAudio.pause();
    return;
  }
  try {
    if (voiceAudio.ended) voiceAudio.currentTime = 0;
    await voiceAudio.play();
  } catch (error) {
    console.error("Could not play the private voice note.", error);
    setVoiceStatus("This recording could not be played by your browser. Try another audio file.");
  }
});

function updateVoicePlayback() {
  const isPlaying = !voiceAudio.paused && !voiceAudio.ended;
  voicePlayer.classList.toggle("is-playing", isPlaying);
  voicePlayButton.setAttribute("aria-label", isPlaying ? "Pause voice note" : "Play voice note");
}

function updateVoicePlaybackTime() {
  voiceCurrentTime.textContent = formatTime(voiceAudio.currentTime);
  if (!Number.isFinite(voiceAudio.duration)) return;
  voiceSeek.max = String(voiceAudio.duration);
  voiceSeek.value = String(voiceAudio.currentTime);
  voiceSeek.style.setProperty("--played", `${voiceAudio.duration ? (voiceAudio.currentTime / voiceAudio.duration) * 100 : 0}%`);
  voiceDuration.textContent = formatTime(voiceAudio.duration);
}

voiceAudio.addEventListener("loadedmetadata", () => {
  if (!voiceObjectUrl) return;
  voiceSeek.disabled = false;
  voicePlayButton.disabled = false;
  updateVoicePlaybackTime();
});
voiceAudio.addEventListener("play", () => {
  updateVoicePlayback();
  setVoiceStatus("Playing your private voice note.");
});
voiceAudio.addEventListener("pause", () => {
  updateVoicePlayback();
  if (voiceObjectUrl && !voiceAudio.ended) setVoiceStatus("Paused. Press play whenever you’re ready.");
});
voiceAudio.addEventListener("ended", () => {
  updateVoicePlayback();
  updateVoicePlaybackTime();
  setVoiceStatus("That was your voice note. Press play to hear it again.");
});
voiceAudio.addEventListener("timeupdate", updateVoicePlaybackTime);
voiceAudio.addEventListener("durationchange", updateVoicePlaybackTime);
voiceAudio.addEventListener("error", () => {
  if (!voiceObjectUrl) return;
  console.error("The private voice-note audio could not be decoded.", voiceAudio.error);
  setVoiceStatus("This recording could not be played by your browser. Try another audio file.");
});
voiceSeek.addEventListener("input", () => {
  if (Number.isFinite(voiceAudio.duration)) {
    voiceAudio.currentTime = Number(voiceSeek.value);
    updateVoicePlaybackTime();
  }
});
window.addEventListener("pagehide", () => {
  if (voiceObjectUrl) URL.revokeObjectURL(voiceObjectUrl);
}, { once: true });

const reasons = [
  "You make being myself feel easy.",
  "Your kindness shows up in the smallest ways.",
  "You make the ordinary feel a little more special.",
  "Your smile has a way of staying with me.",
  "You care with your whole heart.",
  "Simply being you is more than enough."
];
let reasonIndex = 0;
document.querySelector("#reason-button").addEventListener("click", () => {
  reasonIndex = (reasonIndex + 1) % reasons.length;
  const reasonText = document.querySelector("#reason-text");
  reasonText.animate(
    [{ opacity: 0, transform: "translateY(7px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: reducedMotion ? 1 : 260, easing: "ease-out" }
  );
  reasonText.textContent = reasons[reasonIndex];
  document.querySelector("#reason-number").textContent = String(reasonIndex + 1).padStart(2, "0");
});

const questions = [
  {
    prompt: "If we had a whole free afternoon together, what sounds sweetest?",
    options: [
      { label: "A sunset stroll, hand in hand", response: "Then I’m saving the golden hour for us. 💗" },
      { label: "A cozy movie and all the snacks", response: "Cozy, snacky, and right beside you? Perfect. 🍓" },
      { label: "A little adventure somewhere new", response: "Anywhere feels like an adventure when it’s with you. ✨" },
      { label: "Stay in and talk about everything", response: "My favorite place is wherever our conversation takes us. ♡" }
    ]
  },
  {
    prompt: "Pick one tiny thing that can always make a day brighter.",
    options: [
      { label: "A sweet little message", response: "Consider this your reminder: I’m thinking of you right now. 💌" },
      { label: "Flowers just because", response: "You deserve flowers on ordinary days, too. 🌷" },
      { label: "A long, warm hug", response: "Sending you the gentlest, longest hug through the screen. 🫶" },
      { label: "Something delicious to share", response: "I’ll happily share every treat—and steal one tiny bite. 🍰" }
    ]
  },
  {
    prompt: "And what should we always save a little time for?",
    options: [
      { label: "Laughing until our cheeks hurt", response: "Deal. I’ll keep collecting reasons to make you laugh. 💞" },
      { label: "Making new little memories", response: "There are so many lovely little moments still waiting for us. ✨" },
      { label: "Reminding each other we’re loved", response: "Let’s make that one an every-day kind of thing. ♡" },
      { label: "Just being together", response: "That’s my favorite plan, every single time. 💗" }
    ]
  }
];
const finalQuestionSurprise = "Surprise, Salema: whichever answers you picked, my favorite choice will always be you. I love you, endlessly. 💗";
const questionCard = document.querySelector("#question-card");
const questionProgress = document.querySelector("#question-progress");
const questionPrompt = document.querySelector("#question-prompt");
const questionOptions = document.querySelector("#question-options");
const questionFeedback = document.querySelector("#question-feedback");
const questionNextButton = document.querySelector("#question-next");
const questionFinale = document.querySelector("#question-finale");
const questionFinaleMessage = document.querySelector("#question-finale-message");
let currentQuestionIndex = 0;
let questionAnswered = false;

function renderQuestion(focusPrompt = false) {
  if (!questions.length) {
    questionCard.hidden = true;
    questionFinaleMessage.textContent = finalQuestionSurprise;
    questionFinale.hidden = false;
    return;
  }

  const question = questions[currentQuestionIndex];
  questionCard.hidden = false;
  questionProgress.textContent = `QUESTION ${String(currentQuestionIndex + 1).padStart(2, "0")} / ${String(questions.length).padStart(2, "0")}`;
  questionPrompt.textContent = question.prompt;
  questionFeedback.textContent = "";
  questionFeedback.hidden = true;
  questionNextButton.hidden = true;
  questionFinale.hidden = true;
  questionOptions.replaceChildren();

  question.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.className = "question-option";
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--option-delay", reducedMotion ? "0ms" : `${optionIndex * 65}ms`);

    const heart = document.createElement("span");
    heart.className = "question-option-heart";
    heart.setAttribute("aria-hidden", "true");
    heart.textContent = "♡";
    const label = document.createElement("span");
    label.textContent = option.label;
    button.append(heart, label);
    button.addEventListener("click", () => {
      if (questionAnswered) return;
      questionAnswered = true;
      questionOptions.querySelectorAll(".question-option").forEach((choice) => {
        choice.disabled = true;
        choice.setAttribute("aria-pressed", String(choice === button));
      });
      button.classList.add("is-selected");
      button.querySelector(".question-option-heart").textContent = "♥";
      questionFeedback.textContent = option.response;
      questionFeedback.hidden = false;

      if (currentQuestionIndex < questions.length - 1) {
        questionNextButton.hidden = false;
      } else {
        questionFinaleMessage.textContent = finalQuestionSurprise;
        questionFinale.hidden = false;
        questionFinale.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
      }
    });
    questionOptions.append(button);
  });

  if (focusPrompt) questionPrompt.focus({ preventScroll: true });
}

questionNextButton.addEventListener("click", () => {
  if (!questionAnswered || currentQuestionIndex >= questions.length - 1) return;
  currentQuestionIndex += 1;
  questionAnswered = false;
  renderQuestion(true);
});
renderQuestion();

const favoriteButton = document.querySelector(".favorite-button");
const favoriteKey = "only-us-favorite";
try {
  const isFavorite = localStorage.getItem(favoriteKey) === "true";
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.querySelector(".favorite-label").textContent = isFavorite ? "kept close" : "keep this close";
} catch (error) {
  console.warn("This browser does not allow saving the favorite setting.", error);
}
favoriteButton.addEventListener("click", () => {
  const isFavorite = favoriteButton.getAttribute("aria-pressed") !== "true";
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.querySelector(".favorite-label").textContent = isFavorite ? "kept close" : "keep this close";
  try {
    localStorage.setItem(favoriteKey, String(isFavorite));
  } catch (error) {
    console.warn("Could not save the favorite setting in this browser.", error);
  }
});

const celebrationMessage = document.querySelector("#celebration-message");
document.querySelector("#celebrate-button").addEventListener("click", () => {
  celebrationMessage.hidden = false;
  document.querySelector("#celebrate-button").disabled = true;
  document.querySelector("#celebrate-button").setAttribute("aria-label", "A little love has been sent");
  if (!reducedMotion) {
    for (let index = 0; index < 14; index += 1) {
      window.setTimeout(() => createFloaty(index % 2 === 0 ? "♥" : "✿"), index * 55);
    }
  }
});

document.querySelector(".restart-button").addEventListener("click", () => {
  if (giftRevealTimer) window.clearTimeout(giftRevealTimer);
  giftRevealTimer = 0;
  giftPage.classList.remove("is-open");
  giftTrigger.setAttribute("aria-expanded", "false");
  giftTrigger.setAttribute("aria-label", "Open the pink gift");
  giftMessage.hidden = true;
  currentQuestionIndex = 0;
  questionAnswered = false;
  renderQuestion();
  reasonIndex = 0;
  document.querySelector("#reason-text").textContent = reasons[0];
  document.querySelector("#reason-number").textContent = "01";
  celebrationMessage.hidden = true;
  const celebrateButton = document.querySelector("#celebrate-button");
  celebrateButton.disabled = false;
  celebrateButton.removeAttribute("aria-label");
});

function createFloaty(symbol) {
  if (!floatingDecor) return;
  const element = document.createElement("span");
  element.className = "floaty";
  element.textContent = symbol;
  element.style.left = `${Math.random() * 100}%`;
  element.style.fontSize = `${12 + Math.random() * 14}px`;
  element.style.animationDuration = `${7 + Math.random() * 6}s`;
  floatingDecor.append(element);
  element.addEventListener("animationend", () => element.remove(), { once: true });
}

if (!reducedMotion) {
  window.setInterval(() => createFloaty(Math.random() > 0.35 ? "♥" : "✿"), 1700);
}

function handleFirebaseAuthState(user) {
  const previousUid = currentUser?.uid || "";
  const nextUid = user?.uid || "";
  currentUser = user;
  authReady = true;

  if (previousUid !== nextUid) {
    authorizedUserUid = "";
    navigationAttempt += 1;
    authChecking = false;
    clearPrivateContent();
    if (document.body.dataset.section !== "home") activatePage("home");
  }

  updateAuthControls();
  if (user && pendingPageId) {
    showPage(pendingPageId);
  } else if (!user) {
    pendingPageId = pendingPageId || "gift";
    openAuthDialog("Sign in with one of the two authorized accounts to open the private sections.");
  }
}

function handleFirebaseAuthError(error) {
  console.error("Firebase Authentication could not verify the current session.", error);
  firebaseInitState = "error";
  authReady = true;
  currentUser = null;
  authorizedUserUid = "";
  navigationAttempt += 1;
  authChecking = false;
  clearPrivateContent();
  activatePage("home");
  updateAuthControls();
  openAuthDialog("Firebase could not verify your sign-in. Reload the page or check the project configuration.");
}

async function initializeFirebaseServices() {
  try {
    const services = await window.getFirebaseServices();
    if (!services) {
      firebaseInitState = "missing";
      authReady = true;
      openAuthDialog("Add the Firebase web app configuration to enable private sign-in.");
      updateAuthControls();
      return;
    }

    await services.authSdk.setPersistence(services.auth, services.authSdk.inMemoryPersistence);
    firebaseServices = services;
    firebaseInitState = "ready";
    document.documentElement.dataset.firebase = "connected";
    updateAuthControls();
    services.authSdk.onAuthStateChanged(services.auth, handleFirebaseAuthState, handleFirebaseAuthError);
  } catch (error) {
    console.error("Firebase Authentication, Firestore, and Storage could not be initialized.", error);
    firebaseInitState = "error";
    authReady = true;
    openAuthDialog("Firebase could not be initialized. Check the configuration and network.");
    updateAuthControls();
  }
}

initializeFirebaseServices();
