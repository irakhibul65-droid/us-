const firebaseVersion = "10.14.1";
let appPromise;
let servicesPromise;

function getConfig() {
  const config = window.ONLY_US_FIREBASE_CONFIG;
  if (!config || typeof config !== "object") return null;

  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId", "storageBucket"];
  return requiredKeys.every((key) => typeof config[key] === "string" && config[key].trim())
    ? config
    : null;
}

window.getFirebaseApp = async function getFirebaseApp() {
  const config = getConfig();
  if (!config) return null;

  if (!appPromise) {
    appPromise = import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`)
      .then(({ initializeApp, getApps }) => getApps()[0] ?? initializeApp(config))
      .catch((error) => {
        appPromise = undefined;
        throw new Error("Firebase could not be initialized. Check your network and configuration.", { cause: error });
      });
  };
  return appPromise;
};

window.getFirebaseServices = async function getFirebaseServices() {
  const app = await window.getFirebaseApp();
  if (!app) return null;

  if (!servicesPromise) {
    servicesPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-storage.js`)
    ]).then(([authSdk, firestoreSdk, storageSdk]) => ({
      auth: authSdk.getAuth(app),
      firestore: firestoreSdk.getFirestore(app),
      storage: storageSdk.getStorage(app),
      authSdk,
      firestoreSdk,
      storageSdk
    })).catch((error) => {
      servicesPromise = undefined;
      throw new Error("Firebase Authentication, Firestore, and Storage could not be loaded.", { cause: error });
    });
  }
  return servicesPromise;
};
