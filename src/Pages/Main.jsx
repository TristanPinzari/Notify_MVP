import { auth, db, GetUserData, signOutUser } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { storage, bucketId } from "../../appwrite";
import { generateCompiledDoc } from "../../compiler";
import {
  getDoc,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  deleteField,
  writeBatch,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

import { GoPlus } from "react-icons/go";
import { MdDeleteForever } from "react-icons/md";
import { PiSignOut } from "react-icons/pi";

import ToastContainer from "../Components/ToastContainer";
import { ID } from "appwrite";

function Home() {
  const navigate = useNavigate();

  const toastRef = useRef(null);

  const [userData, setUserData] = useState(null);

  const [joinOrCreate, setJoinOrCreate] = useState("join");
  const [visibleOverlay, setVisibleOverlay] = useState("none");
  const [classes, setClasses] = useState([]);
  const [currentClass, setCurrentClass] = useState({});
  const [currentTopic, setCurrentTopic] = useState({});
  const [currentTab, setCurrentTab] = useState("Pinned Doc");
  const [classOverlayValue, setClassOverlayValue] = useState("");
  const [topicOverlayValue, setTopicOverlayValue] = useState("");
  const [classMembers, setClassMembers] = useState({});
  const [grammarCheck, setGrammarCheck] = useState(true);
  const [factCheck, setFactCheck] = useState(true);
  const [extraInfo, setExtraInfo] = useState(false);
  const [bulletFormat, setBulletFormat] = useState("");
  const [compiledDocData, setCompiledDocData] = useState({});
  const [isCompiling, setIsCompiling] = useState(false);

  useEffect(() => {
    //Keeps track of whether the user is still logged in or not
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      if (user) {
        const data = await GetUserData();
        if (!data) {
          navigate("/login");
          return;
        }
        setUserData(data); //Initializes userData so firestore gets uid it requires to make its own observer
      } else {
        setUserData(null);
        navigate("/login");
        return;
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    //Keeps userData in sync with firestore, regardless of whichever user is logged in
    if (!userData) return;
    const userRef = doc(db, "users", userData.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setClasses(data.classes);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.uid]);

  useEffect(() => {
    //Keeps the currently opened class in sync with firestore
    if (!currentClass?.classCode) return;
    const classRef = doc(db, "classes", currentClass.classCode);
    const unsubscribe = onSnapshot(classRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentClass(data);
      }
    });
    return () => unsubscribe();
  }, [currentClass?.classCode]);

  useEffect(() => {
    //Keeps currentTopic in sync
    if (currentTopic?.topicName && currentClass?.topics) {
      if (currentTopic?.topicName in currentClass.topics) {
        setCurrentTopic(currentClass.topics[currentTopic.topicName]);
        return;
      }
    }
    AutoSelectTopic();
    //Keep classMembers updated with members' data
    fillClassMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClass]);

  useEffect(() => {
    //Makes sure the user is not able to see a class they are not in. Also, autoselect if necessary
    if (classes && classes.length > 0) {
      if (classes.some((cls) => cls.classCode == currentClass?.classCode))
        return;
      SelectClass(classes[0].className, classes[0].classCode);
    } else {
      setCurrentClass({});
      setCurrentTopic({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes]);

  useEffect(() => {
    //Auto select topic upon selecting a new class, if possible
    AutoSelectTopic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClass?.classCode]);

  function AutoSelectTopic() {
    if (currentClass && currentClass.topics) {
      const keys = Object.keys(currentClass.topics);
      if (keys.length > 0) {
        setCurrentTopic(currentClass.topics[keys[0]]);
        return;
      }
    }
    setCurrentTopic({});
  }

  async function fillClassMembers() {
    if (!currentClass?.members) {
      setClassMembers([]);
      return;
    }
    const membersData = await Promise.all(
      currentClass.members.map(async (uid) => {
        const snap = await getDoc(doc(db, "users", uid));
        return snap.exists() ? snap.data() : null;
      }),
    );
    setClassMembers(membersData.filter(Boolean));
  }

  const chars = "QWERTYUIOPASDFGHJKLZXCVBNM1234567890";
  const codeLength = 6;
  async function GenerateNewClassCode() {
    let code;
    let exists;
    do {
      code = "";
      for (let i = 0; i < codeLength; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const docSnap = await getDoc(doc(db, "classes", code));
      exists = docSnap.exists();
    } while (exists);
    return code;
  }

  async function RemoveClassFromUser(className, classCode) {
    return updateDoc(doc(db, "users", userData.uid), {
      classes: arrayRemove({ className: className, classCode: classCode }),
    });
  }

  async function CreateNewClass() {
    try {
      const newClassCode = await GenerateNewClassCode();
      const newClassName = classOverlayValue;
      const newClassRef = doc(db, "classes", newClassCode);
      const userRef = doc(db, "users", userData.uid);
      const batch = writeBatch(db);
      batch.set(newClassRef, {
        className: newClassName,
        classCode: newClassCode,
        members: [userData.uid],
      });
      batch.update(userRef, {
        classes: arrayUnion({
          className: newClassName,
          classCode: newClassCode,
        }),
      });
      await batch.commit();
      toastRef.current.addToast("success", "Class created successfully.");
      setVisibleOverlay("none");
      SelectClass(newClassName, newClassCode);
    } catch (error) {
      console.error("Caught error when creating new class:", error);
      toastRef.current.addToast("error", "Class created unsuccessfully.");
    }
  }

  async function JoinNewClass() {
    const classCode = classOverlayValue;
    if (!classCode) return;
    const newClassRef = doc(db, "classes", classCode);
    const newClassSnap = await getDoc(newClassRef);
    if (!newClassSnap.exists()) {
      console.error("Failed joining class | Class does not exist:", classCode);
      toastRef.current.addToast("error", "Class does not exist.");
    } else {
      const classData = newClassSnap.data();
      try {
        const userRef = doc(db, "users", userData.uid);
        const batch = writeBatch(db);
        batch.update(newClassRef, {
          members: arrayUnion(userData.uid),
        });
        batch.update(userRef, {
          classes: arrayUnion({
            className: classData.className,
            classCode: classCode,
          }),
        });
        await batch.commit();
        toastRef.current.addToast("success", "Successfully joined class.");
        setVisibleOverlay("none");
      } catch (error) {
        console.error(
          "Caught error when adding user to class or when updating user's classes list:",
          error,
        );
      }
    }
  }

  async function SelectClass(className, classCode) {
    const classSnap = await getDoc(doc(db, "classes", classCode));
    if (!classSnap.exists()) {
      toastRef.current.addToast("error", "Class no longer exists.");
      await RemoveClassFromUser(className, classCode);
      return;
    }
    const classData = classSnap.data();
    if (!classData.members.includes(userData.uid)) {
      toastRef.current.addToast(
        "error",
        "You are no longer a member of this class.",
      );
      await RemoveClassFromUser(classData.className, classData.classCode);
      return;
    }
    setCurrentClass(classData);
  }

  async function CreateNewTopic() {
    if (!currentClass) return;
    const newTopicName = topicOverlayValue;
    if (currentClass.topics?.newTopicName) {
      toastRef.current.addToast(
        "error",
        "A topic with this name already exists.",
      );
      return;
    }
    try {
      const newObject = { topicName: newTopicName };
      await updateDoc(doc(db, "classes", currentClass.classCode), {
        [`topics.${newTopicName}`]: newObject,
      });
      toastRef.current.addToast("success", "Topic created successfully.");
      setVisibleOverlay("none");
      setCurrentTopic(newObject);
    } catch (error) {
      console.error("Caught error while trying to create new topic:", error);
      return;
    }
  }

  async function uploadPinnedDoc(e) {
    if (!currentClass || !currentTopic?.topicName || !userData) return;
    const file = e.target.files[0];
    e.target.value = null;
    if (!file) {
      toastRef.current.addToast("error", "File does not exist.");
      return;
    }
    if (file.type !== "application/pdf") {
      toastRef.current.addToast("error", "You can only upload a single PDF.");
      return;
    }
    try {
      const fileId = ID.unique();
      await storage.createFile({
        bucketId: bucketId,
        fileId: fileId,
        file: file,
      });
      const fileUrl = storage.getFileDownload({
        bucketId: bucketId,
        fileId: fileId,
      });
      const oldPinnedId = currentTopic?.pinnedDoc?.fileId;
      await updateDoc(doc(db, "classes", currentClass.classCode), {
        [`topics.${currentTopic.topicName}.pinnedDoc`]: {
          pinnedBy: userData.username,
          pinnedDate: Date.now(),
          fileId: fileId,
          fileUrl: fileUrl,
          fleName: file.name,
        },
      });
      toastRef.current.addToast("success", "Successfully pinned file.");
      if (oldPinnedId) deleteFileFromStorage(oldPinnedId);
    } catch (error) {
      console.error("Caught error while pinning uploaded file:", error);
      toastRef.current.addToast(
        "error",
        "Something went wrong while uploading file.",
      );
      return;
    }
  }

  async function pinCompiled() {
    if (!currentClass || !currentTopic?.topicName || !userData) return;
    try {
      const innerHTML =
        compiledDocData[currentClass?.className]?.[currentTopic?.topicName] ||
        "";
      if (innerHTML == "")
        throw new Error("No compiled document to be pinned.");
      const oldPinnedId = currentTopic?.pinnedDoc?.fileId;
      await updateDoc(doc(db, "classes", currentClass.classCode), {
        [`topics.${currentTopic.topicName}.pinnedDoc`]: {
          pinnedBy: userData.username,
          pinnedDate: Date.now(),
          innerHTML: innerHTML,
        },
      });
      toastRef.current.addToast(
        "success",
        "Successfully pinned compiled document.",
      );
      if (oldPinnedId) deleteFileFromStorage(oldPinnedId);
    } catch (error) {
      console.error("Caught error while pinning uploaded file:", error);
      toastRef.current.addToast("error", error);
      return;
    }
  }

  async function isUrlValid(url) {
    try {
      const result = await fetch(url, { method: "HEAD" });
      return result.ok;
    } catch (e) {
      console.error("Invalid url:", e);
      return false;
    }
  }

  async function isPinnedUrlValid(url) {
    const valid = await isUrlValid(url);
    if (!valid) {
      updateDoc(doc(db, "classes", currentClass.classCode), {
        [`topics.${currentTopic.topicName}.pinnedDoc`]: {},
      });
    }
    return valid;
  }

  async function isCollectionUrlValid(doc) {
    const valid = await isUrlValid(doc.fileUrl);
    if (!valid) {
      // deleteFileFromCollection(doc);
    }
    return valid;
  }

  async function uploadToCollection(e) {
    for (const file of e.target.files) {
      try {
        const fileId = ID.unique();
        await storage.createFile({
          bucketId: bucketId,
          fileId: fileId,
          file: file,
        });
        const fileUrl = storage.getFileDownload({
          bucketId: bucketId,
          fileId: fileId,
        });
        await updateDoc(doc(db, "classes", currentClass.classCode), {
          [`topics.${currentTopic.topicName}.collection.${fileId}`]: {
            uploadedBy: userData.username,
            uploadedDate: Date.now(),
            fileId: fileId,
            fileUrl: fileUrl,
            fileName: file.name,
            noCompile: false,
          },
        });
        toastRef.current.addToast(
          "success",
          "Successfully added file to collection.",
        );
      } catch (error) {
        console.error("Caught error while pinning uploaded file:", error);
        toastRef.current.addToast(
          "error",
          "Something went wrong while uploading file.",
        );
        return;
      }
    }
    e.target.value = null;
  }

  async function deleteFileFromStorage(file_id) {
    try {
      await storage.deleteFile({
        bucketId: bucketId,
        fileId: file_id,
      });
      toastRef.current.addToast("success", "File deleted from storage.");
    } catch (e) {
      console.error("Caught error while deleting file from storage:", e);
    }
  }

  function deleteFileFromCollection(document) {
    try {
      updateDoc(doc(db, "classes", currentClass.classCode), {
        [`topics.${currentTopic.topicName}.collection.${document.fileId}`]:
          deleteField(),
      });
      deleteFileFromStorage(document.fileId);
      toastRef.current.addToast("success", "File deleted from DB.");
    } catch (e) {
      toastRef.current.addToast("error", "Something went wrong.");
      console.error("Caught error while deleting file from collection:", e);
    }
  }

  async function collectionToggleCompile(e, id) {
    try {
      await updateDoc(doc(db, "classes", currentClass.classCode), {
        [`topics.${currentTopic.topicName}.collection.${id}.noCompile`]:
          !e.target.checked,
      });
    } catch (error) {
      console.error("Caught error while pinning uploaded file:", error);
      toastRef.current.addToast("error", "Something went wrong.");
      return;
    }
  }

  async function leaveClass() {
    const classCode = currentClass?.classCode;
    if (!classCode) return;
    const ClassRef = doc(db, "classes", classCode);
    const ClassSnap = await getDoc(ClassRef);
    if (!ClassSnap.exists()) {
      console.error("Failed leaving class | Class does not exist:", classCode);
      toastRef.current.addToast("error", "Class does not exist.");
    } else {
      const classData = ClassSnap.data();
      try {
        await RemoveClassFromUser(classData.className, classCode);
        await updateDoc(ClassRef, { members: arrayRemove(userData.uid) });
        toastRef.current.addToast("success", "Successfully left class.");
      } catch (error) {
        console.error(
          "Caught error when removing class from user or when updating class' members list:",
          error,
        );
      }
    }
  }

  async function compileDoc() {
    if (!currentClass || !currentTopic?.collection) return;
    const className = currentClass.className;
    const topicName = currentTopic.topicName;
    let newData = { ...compiledDocData };
    if (!(className in newData)) newData[className] = {};
    setIsCompiling(true);
    newData[className][topicName] = await generateCompiledDoc(
      currentTopic.collection,
      bulletFormat,
      grammarCheck,
      factCheck,
      extraInfo,
    );
    setCompiledDocData(newData);
    setIsCompiling(false);
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return;
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="relative flex w-screen h-screen overflow-hidden bg-[#0f0e0d] font-[DM_Sans]">
      <ToastContainer position="bottom" ref={toastRef} />
      <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
      * { font-family: 'DM Sans', sans-serif; }
      @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      .flash { animation: flash 1.2s ease infinite; }
      .slide-up { animation: slideUp 0.3s ease forwards; }
      ::-webkit-scrollbar { width: 3px; }
      ::-webkit-scrollbar-thumb { background: #b45309; border-radius: 99px; }
    `}</style>
      {visibleOverlay === "classOverlay" && (
        <>
          <div className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 rounded-2xl border border-white/10 bg-[#1a1714] shadow-2xl shadow-black/60 flex flex-col overflow-hidden slide-up">
            <div className="flex border-b border-white/10">
              {["join", "create"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setJoinOrCreate(mode)}
                  className={`flex-1 py-3 text-sm capitalize tracking-widest transition-colors ${
                    joinOrCreate === mode
                      ? "text-amber-400 bg-amber-400/5 font-semibold"
                      : "text-white/40 hover:text-white/70"
                  } border-none bg-transparent cursor-pointer`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="p-6 flex flex-col gap-4">
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-amber-400/50 transition-colors"
                placeholder={
                  joinOrCreate === "join"
                    ? "Enter class code"
                    : "Enter class name"
                }
                value={classOverlayValue}
                onChange={(e) => setClassOverlayValue(e.target.value)}
              />
              <button
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold tracking-wide transition-colors cursor-pointer border-none"
                onClick={
                  joinOrCreate === "join" ? JoinNewClass : CreateNewClass
                }
              >
                {joinOrCreate === "join" ? "Join Class" : "Create Class"}
              </button>
            </div>
          </div>
          <div
            className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm"
            onClick={() => setVisibleOverlay("none")}
          />
        </>
      )}

      {visibleOverlay === "topicOverlay" && (
        <>
          <div className="p-6 absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 rounded-2xl border border-white/10 bg-[#1a1714] shadow-2xl shadow-black/60 overflow-hidden slide-up">
            <div className="pb-2">
              <p className="text-white/60 text-xs tracking-widest uppercase mb-1">
                New Topic
              </p>
              <p className="text-white text-xl font-semibold font-special!">
                Create a topic
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <input
                className="my-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-amber-400/50 transition-colors"
                placeholder="Enter topic name"
                value={topicOverlayValue}
                onChange={(e) => setTopicOverlayValue(e.target.value)}
              />
              <button
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold tracking-wide transition-colors cursor-pointer border-none"
                onClick={CreateNewTopic}
              >
                Create Topic
              </button>
            </div>
          </div>
          <div
            className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm"
            onClick={() => setVisibleOverlay("none")}
          />
        </>
      )}

      {/* ── Left Sidebar ──────────────────────────────────── */}
      <div className="flex flex-col w-52 h-full bg-[#131110] border-r border-white/6 shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-white/6">
          <span className="text-2xl text-white tracking-tight font-special!">
            <span className="text-primary font-special!">N</span>otify
          </span>
        </div>

        {/* Classes */}
        <div className="flex flex-col flex-1 overflow-hidden border-b border-white/6">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold">
              Classes
            </span>
            <GoPlus
              className="text-white/30 hover:text-amber-400 cursor-pointer transition-colors text-base"
              onClick={() => setVisibleOverlay("classOverlay")}
            />
          </div>
          <div className="flex flex-col overflow-y-auto px-2 pb-2">
            {classes?.map((cls, index) => (
              <button
                key={index}
                onClick={() => SelectClass(cls.className, cls.classCode)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border-none cursor-pointer flex items-center gap-2 ${
                  currentClass.classCode === cls.classCode
                    ? "bg-amber-400/10 text-amber-400"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5 bg-transparent"
                }`}
              >
                {currentClass.classCode === cls.classCode && (
                  <span className="w-1 h-4 rounded-full bg-amber-400 shrink-0" />
                )}
                <span
                  className={
                    currentClass.classCode === cls.classCode
                      ? "font-medium"
                      : ""
                  }
                >
                  {cls.className}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold">
              Topics
            </span>
            <GoPlus
              className="text-white/30 hover:text-amber-400 cursor-pointer transition-colors text-base"
              onClick={() => setVisibleOverlay("topicOverlay")}
            />
          </div>
          <div className="flex flex-col overflow-y-auto px-2 pb-2">
            {currentClass.topics &&
              Object.keys(currentClass.topics).map((key, index) => {
                const topic = currentClass.topics[key];
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentTopic(topic)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border-none cursor-pointer flex items-center gap-2 ${
                      currentTopic?.topicName === topic.topicName
                        ? "bg-amber-400/10 text-amber-400"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5 bg-transparent"
                    }`}
                  >
                    {currentTopic?.topicName === topic.topicName && (
                      <span className="w-1 h-4 rounded-full bg-amber-400 shrink-0" />
                    )}
                    <span
                      className={
                        currentTopic?.topicName === topic.topicName
                          ? "font-medium"
                          : ""
                      }
                    >
                      {topic.topicName}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── Main Area ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/6 bg-[#0f0e0d] shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/70 font-medium">
              {currentClass.className}
            </span>
            {currentTopic?.topicName && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-white/50">{currentTopic.topicName}</span>
              </>
            )}
            {currentTab && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-amber-400/80 text-xs tracking-wide">
                  {currentTab}
                </span>
              </>
            )}
          </div>
          <PiSignOut
            className="text-white/30 hover:text-amber-400 text-xl cursor-pointer transition-colors"
            onClick={signOutUser}
          />
        </div>

        {/* Tabs + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tab Rail */}
          <div className="flex flex-col w-44 shrink-0 bg-[#111009] border-r border-white/6">
            <div className="flex flex-col py-3 border-b border-white/6">
              {[
                "Pinned Doc",
                "Compiled Doc",
                "Collection",
                "Members",
                "Class Settings",
              ].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCurrentTab(tab)}
                  className={`text-left px-5 py-2.5 text-xs tracking-wide transition-all border-none cursor-pointer relative ${
                    currentTab === tab
                      ? "text-amber-400 bg-amber-400/5 font-semibold"
                      : "text-white/40 hover:text-white/70 bg-transparent"
                  }`}
                >
                  {currentTab === tab && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 rounded-r-full" />
                  )}
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Controls Panel */}
            <div className="flex-1 flex flex-col justify-center px-4 py-4 gap-3">
              {currentTab === "Pinned Doc" && (
                <>
                  <p className="text-white/30 text-[11px] leading-relaxed">
                    By:{" "}
                    <span className="text-white/60">
                      {currentTopic?.pinnedDoc?.pinnedBy || "—"}
                    </span>
                  </p>
                  <p className="text-white/30 text-[11px] leading-relaxed">
                    Date:{" "}
                    <span className="text-white/60">
                      {formatDate(currentTopic?.pinnedDoc?.pinnedDate) || "—"}
                    </span>
                  </p>
                  <label className="w-full py-2 rounded-lg border border-white/10 text-white/50 text-xs text-center hover:border-amber-400/40 hover:text-amber-400 cursor-pointer transition-all">
                    Pin new PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={uploadPinnedDoc}
                    />
                  </label>
                  <button
                    onClick={pinCompiled}
                    className="w-full py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:border-amber-400/40 hover:text-amber-400 cursor-pointer transition-all bg-transparent"
                  >
                    Pin compiled
                  </button>
                </>
              )}
              {currentTab === "Compiled Doc" && (
                <>
                  <label className="flex items-center gap-2 text-white/50 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={grammarCheck}
                      onChange={(e) => setGrammarCheck(e.target.checked)}
                      className="accent-amber-400"
                    />
                    Grammar check
                  </label>
                  <label className="flex items-center gap-2 text-white/50 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={factCheck}
                      onChange={(e) => setFactCheck(e.target.checked)}
                      className="accent-amber-400"
                    />
                    Fact check
                  </label>
                  <label className="flex items-center gap-2 text-white/50 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extraInfo}
                      onChange={(e) => setExtraInfo(e.target.checked)}
                      className="accent-amber-400"
                    />
                    Extra information
                  </label>
                  <label className="flex items-center gap-2 text-white/50 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulletFormat}
                      onChange={(e) => setBulletFormat(e.target.checked)}
                      className="accent-amber-400"
                    />
                    Bullet format
                  </label>
                  <button
                    onClick={compileDoc}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold cursor-pointer transition-colors border-none mt-1"
                  >
                    Compile
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-[#0c0b0a]">
            {currentTab === "Pinned Doc" && (
              <div className="w-full h-full overflow-y-auto px-16 py-12 relative">
                {currentTopic?.pinnedDoc?.fileUrl &&
                isPinnedUrlValid(currentTopic.pinnedDoc.fileUrl) ? (
                  <iframe
                    className="w-full h-full border-none"
                    src={currentTopic.pinnedDoc.fileUrl.replace(
                      "/download",
                      "/view",
                    )}
                  />
                ) : currentTopic?.pinnedDoc?.innerHTML ? (
                  <>
                    <div className="absolute left-20 top-12 bottom-12 w-px bg-linear-to-b from-amber-400/30 via-amber-400/10 to-transparent" />
                    <div
                      className="mask-[linear-gradient(to_bottom,transparent_0%,black_2%,black_98%,transparent_100%)] [&>*:first-child]:mt-2! w-full h-full overflow-y-auto px-16 max-w-4xl mx-auto [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-sm [&_p]:text-white/75 [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:mb-3 [&_ul]:pl-5 [&_li]:text-sm [&_li]:text-white/75 [&_li]:leading-relaxed [&_li]:list-disc [&_li]:mb-1"
                      dangerouslySetInnerHTML={{
                        __html: currentTopic.pinnedDoc.innerHTML,
                      }}
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-white/20 text-sm">
                      No document pinned yet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentTab === "Collection" && (
              <div className="w-full h-full flex flex-col p-6 gap-4">
                <label className="w-full h-24 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl hover:border-amber-400/40 hover:bg-amber-400/5 cursor-pointer transition-all group">
                  <span className="text-white/20 text-xs group-hover:text-amber-400/60 transition-colors">
                    Drop PDFs here or click to upload
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={uploadToCollection}
                    multiple
                    className="hidden"
                  />
                </label>
                <div className="flex-1 overflow-auto rounded-xl border border-white/6 bg-[#111009]">
                  {currentTopic?.collection &&
                    Object.keys(currentTopic.collection).map((key, index) => {
                      const doc = currentTopic.collection[key];
                      if (isCollectionUrlValid(doc)) {
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-4 px-5 py-3 border-b border-white/4 hover:bg-white/2 transition-colors"
                          >
                            <span className="text-white/20 text-xs w-5 shrink-0">
                              {index + 1}
                            </span>
                            <a
                              href={doc.fileUrl.replace("/download", "/view")}
                              target="_blank"
                              className="flex-1 text-amber-400/80 hover:text-amber-400 text-xs truncate transition-colors"
                            >
                              {doc.fileName || "Document link"}
                            </a>
                            <span className="text-white/30 text-xs shrink-0">
                              {doc.uploadedBy}
                            </span>
                            <span className="text-white/20 text-xs shrink-0">
                              {formatDate(doc.uploadedDate)}
                            </span>
                            <label className="flex items-center gap-1.5 text-white/40 text-xs cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={!doc.noCompile}
                                onChange={(e) =>
                                  collectionToggleCompile(e, doc.fileId)
                                }
                                className="accent-amber-400"
                              />
                              Compile
                            </label>
                            <MdDeleteForever
                              className="text-white/20 hover:text-red-400 text-base cursor-pointer transition-colors shrink-0"
                              onClick={() => deleteFileFromCollection(doc)}
                            />
                          </div>
                        );
                      }
                    })}
                </div>
              </div>
            )}

            {currentTab === "Members" && (
              <div className="w-full h-full flex flex-col p-6 gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-white/40 text-xs uppercase tracking-widest">
                    Class members
                  </p>
                  <button
                    onClick={leaveClass}
                    className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    Leave class
                  </button>
                </div>
                <div className="flex-1 overflow-auto rounded-xl border border-white/6 bg-[#111009]">
                  {classMembers.map((userData, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 px-5 py-3 border-b border-white/4 hover:bg-white/2 transition-colors"
                    >
                      <span className="text-white/20 text-xs w-5 shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-white/70 text-xs">
                        {userData.username}
                      </span>
                      <span className="text-white/30 text-xs">
                        {userData.email}
                      </span>
                      <MdDeleteForever className="text-white/20 hover:text-red-400 text-base cursor-pointer transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentTab === "Compiled Doc" && (
              <div className="w-full h-full overflow-y-auto px-16 py-12 relative">
                <div className="absolute left-20 top-12 bottom-12 w-px bg-linear-to-b from-amber-400/30 via-amber-400/10 to-transparent" />
                {isCompiling ? (
                  <div className="mx-12 flash flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <p className="text-white/40 text-sm">
                      Generating your document…
                    </p>
                  </div>
                ) : (
                  <div
                    className="mask-[linear-gradient(to_bottom,transparent_0%,black_2%,black_98%,transparent_100%)] [&>*:first-child]:mt-2! w-full h-full overflow-y-auto px-16 max-w-4xl mx-auto [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-sm [&_p]:text-white/75 [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:mb-3 [&_ul]:pl-5 [&_li]:text-sm [&_li]:text-white/75 [&_li]:leading-relaxed [&_li]:list-disc [&_li]:mb-1"
                    dangerouslySetInnerHTML={{
                      __html:
                        compiledDocData[currentClass?.className]?.[
                          currentTopic?.topicName
                        ] || "<p>No document compiled yet.</p>",
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
