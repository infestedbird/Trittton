import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyC-uWit8lsDWFE0l6uyqBP_ynH3qX5HYHQ",
  authDomain: "ucsd-a98d8.firebaseapp.com",
  projectId: "ucsd-a98d8",
  storageBucket: "ucsd-a98d8.firebasestorage.app",
  messagingSenderId: "350722020416",
  appId: "1:350722020416:web:6bad9509d6abe697f4fba5",
  measurementId: "G-CCWGTK5K5G"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
