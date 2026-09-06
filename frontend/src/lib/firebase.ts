import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC9kFQ-MeyCKs_dHNhv3jgmiyGcYIhMj9Q",
  authDomain: "momentum-6f432.firebaseapp.com",
  projectId: "momentum-6f432",
  storageBucket: "momentum-6f432.firebasestorage.app",
  messagingSenderId: "1078198862822",
  appId: "1:1078198862822:web:ed7925626073394829cc27",
  measurementId: "G-V8KB0ZKTMM"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

let analytics: any;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, analytics };

