import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import AdminChatView from './components/AdminChatView';
import { initializeApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getAuth
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, appId, firebaseConfig, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COHORTS, MAJORS } from './constants';
import {
  ShieldAlert,
  Users,
  FileText,
  Megaphone,
  GraduationCap,
  LogOut,
  Sun,
  Moon,
  Trash2,
  Plus,
  Search,
  Check,
  X,
  Shield,
  Activity,
  FileQuestion,
  AlertTriangle,
  RefreshCw,
  Info,
  Edit3,
  Menu,
  Calendar,
  Eye,
  EyeOff,
  Save,
  Clock,
  DownloadCloud,
  UploadCloud,
  MessageCircle,
  Flag,
  Bell
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const theme = 'light';
  const setTheme = () => { };
  const [currentTab, setCurrentTab] = useState('overview');
  const [isLogin, setIsLogin] = useState(true);

  // Input states for Login & Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [registerSecret, setRegisterSecret] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Firestore real-time collections
  const [students, setStudents] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [exams, setExams] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [reports, setReports] = useState([]);
  const [chatReports, setChatReports] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adminChatCohort, setAdminChatCohort] = useState(COHORTS[0]);
  const [adminChatMajor, setAdminChatMajor] = useState(MAJORS[0]);
  const [adminGroupMessages, setAdminGroupMessages] = useState([]);
  const [adminMentions, setAdminMentions] = useState([]);
  const [lastSeenAdminGroupChat, setLastSeenAdminGroupChat] = useState(parseInt(localStorage.getItem('lastSeenAdminGroupChat') || '0'));

  useEffect(() => {
    if (currentTab === 'admin_chat') {
      const now = Date.now();
      localStorage.setItem('lastSeenAdminGroupChat', now.toString());
      setLastSeenAdminGroupChat(now);
    }
  }, [currentTab, adminGroupMessages]);

  // Exam Schedule Builder States
  const [schedTitle, setSchedTitle] = useState('');
  const [schedType, setSchedType] = useState('midterm');
  const [schedCohort, setSchedCohort] = useState(COHORTS[0]);
  const [schedMajor, setSchedMajor] = useState('كل التخصصات');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedExams, setSchedExams] = useState([]);
  const [schedStatus, setSchedStatus] = useState('');
  const [schedExamDate, setSchedExamDate] = useState('');
  const [schedExamSubject, setSchedExamSubject] = useState('');

  // Material Creation Form States
  const [matTitle, setMatTitle] = useState('');
  const [matType, setMatType] = useState('pdf');
  const [matCohort, setMatCohort] = useState(COHORTS[0]);
  const [matMajor, setMatMajor] = useState(MAJORS[0]);
  const [matUrl, setMatUrl] = useState('');
  const [matStatus, setMatStatus] = useState('');
  const [matPdfBase64, setMatPdfBase64] = useState('');
  const [uploadMode, setUploadMode] = useState('link'); // 'link' or 'file'

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 22 * 1024 * 1024) {
      showAlert("حجم ملف الـ PDF كبير جداً! يرجى اختيار ملف أصغر من 22 ميجابايت لضمان سرعة المعالجة واستقرار الأداء الأكاديمي.", "الملف كبير جداً ⚠️");
      e.target.value = '';
      return;
    }

    setMatStatus('جاري معالجة وتفصيل ملف الـ PDF... يرجى الانتظار ⚡');
    const reader = new FileReader();
    reader.onloadend = () => {
      setMatPdfBase64(reader.result);
      setMatStatus('✓ تم تجهيز الملف بنجاح! جاهز للبث والرفع فوريًا.');
    };
    reader.readAsDataURL(file);
  };

  // Announcement Broadcaster Form States
  const [annMsg, setAnnMsg] = useState('');
  const [annType, setAnnType] = useState('alert');
  const [annCohort, setAnnCohort] = useState(COHORTS[0]);
  const [annMajor, setAnnMajor] = useState('كل التخصصات');
  const [annStatus, setAnnStatus] = useState('');

  // Exam Builder States
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(15);
  const [examCohort, setExamCohort] = useState(COHORTS[0]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [examStatus, setExamStatus] = useState('');
  const [examMajor, setExamMajor] = useState('كل التخصصات');
  const [editingExamId, setEditingExamId] = useState(null);
  const [examStartDate, setExamStartDate] = useState('');
  const [examEndDate, setExamEndDate] = useState('');

  // Helper variables for adding a single question
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState('mcq'); // mcq, tf, essay
  const [qOptA, setQOptA] = useState('');

  const excelInputRef = useRef(null);

  const handleDownloadExcelTemplate = () => {
    const wsData = [
      ["التاريخ", "المقرر"],
      ["02/06/2026", "ادارة الموارد البشرية"],
      ["04/06/2026", "إدارة المؤسسات العامة"],
      ["07/06/2026", "البنية التحتية لتكنولوجيا المعلومات"],
      ["09/06/2026", "قواعد بيانات متقدمة"],
      ["11/06/2026", "رياده الاعمال"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الجدول");
    XLSX.writeFile(wb, "جدول_الامتحانات_قالب.xlsx");
  };

  const handleUploadExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const getArabicDay = (dateStr) => {
          if (!dateStr) return '';
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(dateObj)) {
              return dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
            }
          }
          return '';
        };

        const newExams = data.map(row => {
          const dStr = (row['التاريخ'] || row['تاريخ ووقت اللجنة'] || '').toString().trim();
          const dayName = getArabicDay(dStr);
          const finalDate = dayName ? `${dayName} ${dStr}` : dStr;

          return {
            date: finalDate,
            subject: (row['المقرر'] || row['اسم المقرر'] || row['المادة'] || '').toString().trim(),
          };
        }).filter(ex => ex.date && ex.subject);

        if (newExams.length === 0) {
          setSchedStatus('⚠️ لم يتم العثور على أي مواد صالحة في ملف الإكسيل. تأكد من استخدام القالب الصحيح.');
          setTimeout(() => setSchedStatus(''), 4000);
          return;
        }

        setSchedExams(prev => [...prev, ...newExams]);
        setSchedStatus(`✅ تم استيراد ${newExams.length} مادة من ملف الإكسيل بنجاح!`);
        setTimeout(() => setSchedStatus(''), 4000);
      } catch (err) {
        setSchedStatus('حدث خطأ أثناء قراءة ملف الإكسيل: ' + err.message);
        setTimeout(() => setSchedStatus(''), 4000);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset
  };
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState(0); // Index 0-3 for MCQ, 0-1 for True/False (0: صح, 1: خطأ)
  const [editingQuestionIdx, setEditingQuestionIdx] = useState(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [notiDropdownOpen, setNotiDropdownOpen] = useState(false);

  // Add Staff Member Form States
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('helper');
  const [newStaffCohort, setNewStaffCohort] = useState('كل الفرق');
  const [newStaffMajor, setNewStaffMajor] = useState('كل التخصصات');
  const [newStaffStatus, setNewStaffStatus] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Exam Submissions and Grading States
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [essayGradeInput, setEssayGradeInput] = useState({});
  const [essayFeedbackText, setEssayFeedbackText] = useState('');

  // Custom dialog modals replacing browser alert/confirm
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm', // 'confirm' | 'alert'
    onConfirm: null,
    onCancel: null
  });

  const showConfirm = (message, onConfirm, title = 'تأكيد الإجراء ⚠️') => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        onConfirm();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showAlert = (message, title = 'تنبيه 💡') => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Custom Ban Modal Configuration State & Submit Handler
  const [banModalConfig, setBanModalConfig] = useState({
    isOpen: false,
    studentUid: '',
    studentName: '',
    reason: '',
    banType: 'temp', // 'temp' | 'perm'
    durationHours: '24'
  });

  const handleConfirmBanSubmit = async () => {
    const { studentUid, studentName, reason, banType, durationHours } = banModalConfig;
    if (!reason.trim()) {
      showAlert("يجب إدخال سبب الحظر لتوثيقه للطالب.", "خطأ ⚠️");
      return;
    }

    let banUntil = null;
    if (banType === 'temp') {
      const hours = parseInt(durationHours, 10);
      if (isNaN(hours) || hours <= 0) {
        showAlert("عدد ساعات الحظر غير صالح.", "خطأ ⚠️");
        return;
      }
      banUntil = Date.now() + hours * 60 * 60 * 1000;
    }

    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', studentUid, 'profile', 'details');
      const directoryRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', studentUid);
      await updateDoc(profileRef, {
        isBanned: true,
        banType,
        banUntil,
        banReason: reason
      });
      await updateDoc(directoryRef, {
        isBanned: true
      });
      setBanModalConfig(prev => ({ ...prev, isOpen: false }));
      logAdminAction('حظر طالب', `تم حظر الطالب: ${studentName} لسبب: ${reason}`);
      showAlert(`تم حظر حساب الطالب ${studentName} بنجاح.`, "تم الحظر 🚫");
    } catch (e) {
      showAlert("فشل الحظر: " + e.message, "فشل الإجراء");
    }
  };

  useEffect(() => {
    // Force light mode permanently for the admin dashboard
    document.documentElement.classList.remove('dark');
    document.body.classList.add('light');
  }, []);

  // Auth Listener with Real-Time Profile Updates
  useEffect(() => {
    let profileUnsub = () => { };
    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'details');
        profileUnsub = onSnapshot(profileRef, async (profileSnap) => {
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            if (profileData.role === 'admin' || profileData.role === 'helper') {
              setProfile({ uid: currentUser.uid, ...profileData });
              setUser(currentUser);
              setAuthError('');
            } else {
              setAuthError('⛔ عذراً، لا تمتلك صلاحيات الدخول كمسؤول أو مساعد للمنصة!');
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          } else {
            setAuthError('⛔ لم يتم العثور على ملف أكاديمي مسجل لهذا الحساب!');
            await signOut(auth);
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile listen error:", err);
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      profileUnsub();
    };
  }, []);

  // Sync helper's active cohort with allowed cohorts
  useEffect(() => {
    if (profile && profile.role === 'helper' && profile.allowedCohorts && profile.allowedCohorts.length > 0) {
      const firstCohort = profile.allowedCohorts[0];
      setAdminChatCohort(firstCohort);
      setMatCohort(firstCohort);
      setAnnCohort(firstCohort);
      setExamCohort(firstCohort);
      setSchedCohort(firstCohort);
    }
  }, [profile]);

  // Enforce role permission guards on client-side navigation tabs
  useEffect(() => {
    if (profile && profile.role === 'helper' && ['students', 'staff'].includes(currentTab)) {
      setCurrentTab('overview');
    }
  }, [currentTab, profile]);

  // Close mobile sidebar menu on tab change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentTab]);

  const logAdminAction = async (action, details) => {
    try {
      if (!profile || !profile.uid) return;
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'admin_logs');
      await addDoc(logsRef, {
        action,
        details,
        adminName: profile.name,
        adminUid: profile.uid,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Log error:", e);
    }
  };

  // Listen to Firestore documents once logged in
  useEffect(() => {
    if (!user || !profile) return;

    // 1. Listen to Student Directory
    const dirRef = collection(db, 'artifacts', appId, 'public', 'data', 'student_directory');
    const unsubStudents = onSnapshot(dirRef, (snapshot) => {
      setStudents(snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, uid: doc.id, ...data };
      }));
    });

    // 2. Listen to Academic Materials
    const matRef = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
    const unsubMats = onSnapshot(matRef, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Listen to Exams
    const examRef = collection(db, 'artifacts', appId, 'public', 'data', 'exams');
    const unsubExams = onSnapshot(examRef, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 4. Listen to Announcements
    const annRef = collection(db, 'artifacts', appId, 'public', 'data', 'announcements');
    const unsubAnn = onSnapshot(annRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setAnnouncements(list);
    });

    // 5. Listen to Profile Reports
    const repRef = collection(db, 'artifacts', appId, 'public', 'data', 'reports');
    const unsubReports = onSnapshot(repRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setReports(list);
    });

    // 5b. Listen to Chat Reports
    const chatRepRef = collection(db, 'artifacts', appId, 'public', 'data', 'chat_reports');
    const unsubChatReports = onSnapshot(chatRepRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setChatReports(list);
    });

    // 6. Listen to Exam Submissions
    const subRef = collection(db, 'artifacts', appId, 'exam_submissions');
    const unsubSubs = onSnapshot(subRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setSubmissions(list);
    });

    // 7. Listen to Exam Schedules
    const schedRef = collection(db, 'artifacts', appId, 'public', 'data', 'exam_schedules');
    const unsubScheds = onSnapshot(schedRef, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 8. Listen to Admin Logs (and auto-cleanup old ones)
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'admin_logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const list = [];
      const now = Date.now();
      const weekInMs = 7 * 24 * 60 * 60 * 1000;

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.timestamp) {
          const logTime = data.timestamp.toMillis();
          if (now - logTime > weekInMs) {
            deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_logs', docSnap.id));
          } else {
            list.push({ id: docSnap.id, ...data });
          }
        } else {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setLogs(list);
    });

    // 9. Listen to Admin Mentions
    const mentionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'admin_mentions');
    const unsubMentions = onSnapshot(mentionsRef, (snapshot) => {
      const list = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.adminId === profile.uid || data.adminId === 'admin_support') {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

      // Show Toast/Alert for new mentions (if any new mention added since first load)
      let mentionsFirstLoad = adminMentions.length === 0;
      if (!mentionsFirstLoad && list.length > adminMentions.length) {
        const newMention = list[0]; // because sorted descending by timestamp
        if (newMention.mentionerId !== profile.uid) {
          playNotificationSound();
          showAlert(`🚨 تم ذكرك بواسطة ${newMention.mentionerName} في شات دفعة ${newMention.cohort}! \nالرسالة: "${newMention.text}"`, "ذكر في الشات (Mention)");
        }
      }

      setAdminMentions(list);
    }, (err) => console.error("Admin mentions fetch error:", err));

    return () => {
      unsubStudents();
      unsubMats();
      unsubExams();
      unsubAnn();
      unsubReports();
      unsubChatReports();
      unsubSubs();
      unsubScheds();
      unsubLogs();
      unsubMentions();
    };
  }, [user, profile]);

  // Isolated useEffect for Admin Group Chat fetching
  useEffect(() => {
    if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'helper')) return;

    const cohortSafe = adminChatCohort.replace(/\s+/g, '_');
    const majorSafe = adminChatMajor.replace(/\s+/g, '_');
    const chatRef = collection(db, 'artifacts', appId, 'public', 'data', `chat_${cohortSafe}_${majorSafe}`);

    const unsubGroup = onSnapshot(chatRef, (snapshot) => {
      const msgs = [];
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const msgTime = data.timestamp?.toMillis() || 0;

        if (msgTime > 0 && msgTime < threeDaysAgo) {
          // Admins can trigger auto-delete of expired messages too
          deleteDoc(docSnap.ref).catch(err => console.error("Auto-delete chat error:", err));
        } else {
          msgs.push({ id: docSnap.id, ...data });
        }
      });

      let adminChatFirstLoad = adminGroupMessages.length === 0;

      msgs.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));

      if (!adminChatFirstLoad && msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== profile.uid) {
          if (lastMsg.mentions && (lastMsg.mentions.includes(profile.uid) || lastMsg.mentions.includes('admin_support'))) {
            const displayName = lastMsg.senderNickname || lastMsg.senderName;
            showAlert(`تم ذكر الإدارة في رسالة جديدة بواسطة ${displayName}!`, "إشعار منشن");
          }
        }
      }

      setAdminGroupMessages(msgs);
    }, (err) => console.error(err));

    return () => unsubGroup();
  }, [user, profile, adminChatCohort, adminChatMajor]);

  // Get lists filtered by helper's assigned cohort and major restriction
  const getFilteredMaterials = () => {
    if (!profile) return [];
    let list = materials;
    if (profile.role === 'helper') {
      if (profile.assignedCohort && profile.assignedCohort !== 'كل الفرق') {
        list = list.filter(m => m.cohort === profile.assignedCohort);
      }
      if (profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات') {
        list = list.filter(m => m.major === profile.assignedMajor);
      }
    }
    return list;
  };

  const getFilteredAnnouncements = () => {
    if (!profile) return [];
    let list = announcements;
    if (profile.role === 'helper') {
      if (profile.assignedCohort && profile.assignedCohort !== 'كل الفرق') {
        list = list.filter(a => a.cohort === profile.assignedCohort);
      }
      if (profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات') {
        list = list.filter(a => a.major === profile.assignedMajor);
      }
    }
    return list;
  };

  const getFilteredExams = () => {
    if (!profile) return [];
    let list = exams;
    if (profile.role === 'helper') {
      if (profile.assignedCohort && profile.assignedCohort !== 'كل الفرق') {
        list = list.filter(e => e.cohort === profile.assignedCohort);
      }
      if (profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات') {
        list = list.filter(e => e.major === profile.assignedMajor);
      }
    }
    return list;
  };

  const getFilteredReports = () => {
    if (!profile) return [];
    let list = reports;
    if (profile.role === 'helper') {
      if (profile.assignedCohort && profile.assignedCohort !== 'كل الفرق') {
        list = list.filter(r => {
          const reporterStudent = students.find(s => s.id === r.reporterUid);
          return reporterStudent?.cohort === profile.assignedCohort;
        });
      }
      if (profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات') {
        list = list.filter(r => {
          const reporterStudent = students.find(s => s.id === r.reporterUid);
          return reporterStudent?.major === profile.assignedMajor;
        });
      }
    }
    return list;
  };

  const getFilteredSubmissions = () => {
    if (!profile) return [];
    let list = submissions;
    if (profile.role === 'helper') {
      if (profile.assignedCohort && profile.assignedCohort !== 'كل الفرق') {
        list = list.filter(s => s.studentCohort === profile.assignedCohort);
      }
      if (profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات') {
        list = list.filter(s => s.studentMajor === profile.assignedMajor);
      }
    }
    return list;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError('');
    setSuccessMsg('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setAuthError('خطأ: البريد الإلكتروني أو كلمة المرور غير صحيحة، أو عطل بالخادم.');
    }
    setLoginLoading(false);
  };

  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError('');
    setSuccessMsg('');

    const EXPECTED_SECRET = 'TAIBA_ADMIN_2026';
    if (registerSecret.trim() !== EXPECTED_SECRET) {
      setAuthError('⛔ مفتاح التسجيل السري غير صحيح! لا يمكنك إنشاء حساب مسؤول.');
      setLoginLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const registeredUser = userCredential.user;

      const randomId = Math.floor(10000 + Math.random() * 90000);
      const generatedStudentId = `ADM-${randomId}`;

      const newAdminProfile = {
        name: adminName,
        email: email,
        uid: registeredUser.uid,
        studentId: generatedStudentId,
        role: 'admin',
        cohort: 'الفرقة الرابعة',
        major: 'علوم حاسب',
        bio: 'مسؤول لوحة التحكم الفنية والإدارية 👑',
        avatarUrl: '',
        hideEmail: false,
        hidePhone: false,
        createdAt: new Date().toISOString()
      };

      const userDocRef = doc(db, 'artifacts', appId, 'users', registeredUser.uid, 'profile', 'details');
      await setDoc(userDocRef, newAdminProfile);

      const publicDirRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', registeredUser.uid);
      await setDoc(publicDirRef, {
        uid: registeredUser.uid,
        studentId: generatedStudentId,
        name: adminName,
        email: email,
        major: 'علوم حاسب',
        cohort: 'الفرقة الرابعة',
        role: 'admin',
        status: 'online',
        lastSeen: new Date().toISOString()
      });

      setSuccessMsg('🎉 تم إنشاء حساب المسؤول بنجاح! جاري تحويلك للوحة التحكم...');
      setProfile(newAdminProfile);
      setUser(registeredUser);
      setAuthError('');
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        msg = 'البريد الإلكتروني مسجل بالفعل بالمنصة.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة للغاية، يرجى إدخال 6 أحرف على الأقل.';
      }
      setAuthError(msg);
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    showConfirm("هل تريد تسجيل الخروج من لوحة التحكم؟", async () => {
      await signOut(auth);
    }, "تسجيل الخروج");
  };

  // Promote / Demote Student
  const handleUpdateRole = async (studentId, newRole) => {
    try {
      // 1. Update in student directory
      const dirDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', studentId);
      await updateDoc(dirDocRef, { role: newRole });

      // 2. Update private profile Details node
      const profileDetailsRef = doc(db, 'artifacts', appId, 'users', studentId, 'profile', 'details');
      await updateDoc(profileDetailsRef, { role: newRole });

      logAdminAction('ترقية/تخفيض رتبة', `تم تغيير رتبة المستخدم إلى ${newRole}`);
      showAlert(`تم بنجاح تحديث رتبة المستخدم إلى: ${newRole === 'admin' ? 'مدير' : newRole === 'helper' ? 'مساعد' : 'طالب عادي'}`, "تحديث الرتبة");
    } catch (e) {
      showAlert("خطأ أثناء تحديث الرتبة: " + e.message, "فشل الإجراء");
    }
  };

  // Update Assigned Cohort for Staff Member
  const handleUpdateStaffCohort = async (staffId, cohort) => {
    try {
      const dirDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', staffId);
      await updateDoc(dirDocRef, { assignedCohort: cohort });

      const profileDetailsRef = doc(db, 'artifacts', appId, 'users', staffId, 'profile', 'details');
      await updateDoc(profileDetailsRef, { assignedCohort: cohort });

      showAlert(`تم تحديث الفرقة المرتبطة بالمشرف بنجاح إلى: ${cohort}`, "تحديث الفرقة");
    } catch (e) {
      showAlert("خطأ أثناء تحديث الفرقة: " + e.message, "فشل الإجراء");
    }
  };

  // Update Assigned Major for Staff Member
  const handleUpdateStaffMajor = async (staffId, major) => {
    try {
      const dirDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', staffId);
      await updateDoc(dirDocRef, { assignedMajor: major });

      const profileDetailsRef = doc(db, 'artifacts', appId, 'users', staffId, 'profile', 'details');
      await updateDoc(profileDetailsRef, { assignedMajor: major });

      showAlert(`تم تحديث التخصص المرتبط بالمشرف بنجاح إلى: ${major}`, "تحديث التخصص");
    } catch (e) {
      showAlert("خطأ أثناء تحديث التخصص: " + e.message, "فشل الإجراء");
    }
  };

  // Update Admin Nickname
  const handleUpdateStaffNickname = async (staffId, nickname) => {
    try {
      const dirDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', staffId);
      await updateDoc(dirDocRef, { adminNickname: nickname });

      const profileDetailsRef = doc(db, 'artifacts', appId, 'users', staffId, 'profile', 'details');
      await updateDoc(profileDetailsRef, { adminNickname: nickname });

      showAlert(`تم تعيين الاسم المستعار بنجاح: ${nickname}`, "تحديث الاسم");
    } catch (e) {
      showAlert("خطأ أثناء تعيين الاسم المستعار: " + e.message, "فشل الإجراء");
    }
  };

  // Update Helper Permissions
  const handleUpdateStaffPermissions = async (staffId, permissions) => {
    try {
      const dirDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', staffId);
      await updateDoc(dirDocRef, { permissions });

      const profileDetailsRef = doc(db, 'artifacts', appId, 'users', staffId, 'profile', 'details');
      await updateDoc(profileDetailsRef, { permissions });

      showAlert("تم تحديث صلاحيات المشرف بدقة.", "تحديث الصلاحيات");
    } catch (e) {
      showAlert("خطأ أثناء تحديث الصلاحيات: " + e.message, "فشل الإجراء");
    }
  };
  // Update Helper Allowed Cohorts
  const handleUpdateStaffAllowedCohorts = async (staffId, cohortName, isChecked) => {
    try {
      const staffDoc = students.find(s => s.id === staffId);
      let currentAllowed = staffDoc?.allowedCohorts || [];
      if (isChecked) {
        if (!currentAllowed.includes(cohortName)) {
          currentAllowed = [...currentAllowed, cohortName];
        }
      } else {
        currentAllowed = currentAllowed.filter(c => c !== cohortName);
      }

      const dirDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', staffId);
      await updateDoc(dirDocRef, { allowedCohorts: currentAllowed });

      const profileDetailsRef = doc(db, 'artifacts', appId, 'users', staffId, 'profile', 'details');
      await updateDoc(profileDetailsRef, { allowedCohorts: currentAllowed });

      showAlert("تم تحديث الفرق الدراسية المسموح بها للمساعد بنجاح.", "تحديث الصلاحيات");
    } catch (e) {
      showAlert("خطأ أثناء تحديث الفرق المسموح بها: " + e.message, "فشل الإجراء");
    }
  };
  // Suspend / Delete Student Profile
  const handleDeleteStudent = async (studentUid, name) => {
    showConfirm(`⚠️ تحذير: هل أنت متأكد من حذف الحساب الدراسي للطالب ${name} نهائياً؟`, async () => {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', studentUid));
        await deleteDoc(doc(db, 'artifacts', appId, 'users', studentUid, 'profile', 'details'));
        logAdminAction('إقصاء طالب', `تم حذف حساب الطالب نهائياً: ${name}`);
        showAlert("تم إقصاء وحذف الحساب الأكاديمي للطالب بنجاح.", "حذف حساب طالب");
      } catch (e) {
        showAlert("فشل الحذف: " + e.message, "فشل الإجراء");
      }
    }, "تأكيد حذف الحساب");
  };

  // Toggle Ban/Block Student
  const handleToggleBanStudent = async (studentUid, name, isBanned) => {
    if (isBanned) {
      showConfirm(`هل تريد إلغاء حظر حساب الطالب ${name} وإعادة تفعيل صلاحياته الأكاديمية؟`, async () => {
        try {
          const profileRef = doc(db, 'artifacts', appId, 'users', studentUid, 'profile', 'details');
          const directoryRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', studentUid);
          await updateDoc(profileRef, { isBanned: false, banType: null, banUntil: null, banReason: null });
          await updateDoc(directoryRef, { isBanned: false });
          logAdminAction('فك حظر طالب', `تم فك الحظر عن الطالب: ${name}`);
          showAlert(`تم إلغاء حظر الطالب ${name} بنجاح.`, "فك الحظر 🔓");
        } catch (e) {
          showAlert("فشل الإجراء: " + e.message, "فشل فك الحظر");
        }
      }, "تأكيد فك الحظر");
    } else {
      setBanModalConfig({
        isOpen: true,
        studentUid,
        studentName: name,
        reason: '',
        banType: 'temp',
        durationHours: '24'
      });
    }
  };

  // Delete Material
  const handleDeleteMaterial = async (matId, isChunked, totalChunks) => {
    showConfirm("هل تريد حذف هذا المقرر الدراسي نهائياً بكافة ملفاته السحابية؟", async () => {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', matId));
        if (isChunked && totalChunks) {
          for (let i = 0; i < totalChunks; i++) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', matId, 'chunks', String(i)));
          }
        }
        logAdminAction('حذف مقرر/مادة', `تم حذف المادة ذات المعرف: ${matId}`);
      } catch (err) {
        console.error("Error deleting material chunks:", err);
      }
    }, "حذف مقرر");
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (annId) => {
    showConfirm("هل تريد حذف هذا التنبيه؟", async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'announcements', annId));
      logAdminAction('حذف إعلان/تنبيه', `تم حذف الإعلان: ${annId}`);
    }, "حذف إعلان");
  };

  // Delete Report
  const handleDeleteReport = async (repId) => {
    showConfirm("هل تريد حذف أو تجاهل هذا البلاغ؟", async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reports', repId));
    }, "إدارة البلاغات");
  };

  // Delete Exam
  const handleDeleteExam = async (examId) => {
    showConfirm("هل تريد حذف هذا الاختبار التجريبي نهائياً؟", async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', examId));
      logAdminAction('حذف اختبار', `تم حذف الاختبار: ${examId}`);
    }, "حذف اختبار");
  };

  // Add Material
  const handleAddMaterialSubmit = async (e) => {
    e.preventDefault();
    setMatStatus('جاري بدء الرفع وتأمين الملف...');
    try {
      const finalCohort = (profile && profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق')
        ? profile.assignedCohort
        : matCohort;
      const finalMajor = (profile && profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات')
        ? profile.assignedMajor
        : matMajor;

      let finalUrl = '#';
      let isChunked = false;
      let totalChunks = 0;
      let matId = doc(collection(db, 'artifacts', appId, 'public', 'data', 'materials')).id;

      if (uploadMode === 'link') {
        finalUrl = matUrl.trim() || '#';
      } else {
        if (!matPdfBase64) {
          showAlert("يرجى اختيار ملف الـ PDF أولاً ليتم رفعه مباشرة.", "ملف غير موجود ⚠️");
          setMatStatus('');
          return;
        }

        // Chunking Base64
        setMatStatus('جاري تقسيم وتفتيت الملف إلى حزم سحابية مضغوطة...');
        const chunkSize = 800 * 1024; // 800KB chunk size
        const chunks = [];
        for (let i = 0; i < matPdfBase64.length; i += chunkSize) {
          chunks.push(matPdfBase64.substring(i, i + chunkSize));
        }

        totalChunks = chunks.length;
        isChunked = true;
        finalUrl = `chunked:${matId}`;

        setMatStatus(`جاري بث ورفع الحزم السحابية (0 من ${totalChunks})...`);

        // Upload chunks in batches/parallel to prevent Firestore congestion
        const chunkPromises = chunks.map((chunkData, index) => {
          const chunkRef = doc(db, 'artifacts', appId, 'public', 'data', 'materials', matId, 'chunks', String(index));
          return setDoc(chunkRef, {
            index: index,
            data: chunkData
          });
        });

        await Promise.all(chunkPromises);
      }

      const matRef = doc(db, 'artifacts', appId, 'public', 'data', 'materials', matId);
      await setDoc(matRef, {
        title: matTitle,
        type: matType,
        cohort: finalCohort,
        major: finalMajor,
        url: finalUrl,
        isChunked: isChunked,
        totalChunks: totalChunks,
        createdAt: serverTimestamp(),
        addedBy: profile.name
      });

      setMatTitle('');
      setMatUrl('');
      setMatPdfBase64('');
      logAdminAction('رفع مادة/مقرر', `تم رفع المادة: ${matTitle}`);
      setMatStatus('تم الرفع البث والتعميم للطلاب بنجاح! 🍉');
    } catch (err) {
      console.error(err);
      setMatStatus('فشل الرفع: ' + err.message);
      showAlert("حدث خطأ أثناء حفظ الملف المجزأ بقاعدة البيانات: " + err.message, "فشل الرفع ❌");
    }
    setTimeout(() => setMatStatus(''), 4000);
  };

  // Broadcast Announcement
  const handleAddAnnSubmit = async (e) => {
    e.preventDefault();
    if (!annMsg.trim()) return;

    showConfirm(`هل أنت متأكد من رغبتك في بث هذا الإشعار فوراً للطلاب؟\n\n"${annMsg}"\n\nسيتم إرسال الإشعار إلى: ${annCohort} - ${annMajor}`, async () => {
      setAnnStatus('جاري النشر...');
      try {
        const finalCohort = (profile && profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق')
          ? profile.assignedCohort
          : annCohort;
        const finalMajor = (profile && profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات')
          ? profile.assignedMajor
          : annMajor;
        const annRef = collection(db, 'artifacts', appId, 'public', 'data', 'announcements');
        await addDoc(annRef, {
          msg: annMsg,
          type: annType,
          cohort: finalCohort,
          major: finalMajor,
          createdAt: serverTimestamp(),
          addedBy: profile.name
        });

        logAdminAction('بث إشعار جديد', `تم بث إشعار جديد: ${annMsg}`);
        setAnnMsg('');
        setAnnStatus('');
        showAlert('تم تعميم وبث الإشعار الدراسي بنجاح للطلاب! 🔔', 'إشعار تم بنجاح');
      } catch (err) {
        setAnnStatus('خطأ: ' + err.message);
      }
      setTimeout(() => setAnnStatus(''), 4000);
    }, 'تأكيد إرسال إشعار 📢');
  };

  // Add/Update Question inside Exam Array
  const handleAddQuestionToExam = () => {
    if (!qText.trim()) return;

    let questionObj = {
      q: qText,
      type: qType
    };

    if (qType === 'mcq') {
      questionObj.options = [qOptA, qOptB, qOptC, qOptD];
      questionObj.correct = parseInt(qCorrect);
    } else if (qType === 'tf') {
      questionObj.options = ['صح ✅', 'خطأ ❌'];
      questionObj.correct = parseInt(qCorrect);
    } else {
      questionObj.options = [];
      questionObj.correct = null;
    }

    if (editingQuestionIdx !== null) {
      const updated = [...examQuestions];
      updated[editingQuestionIdx] = questionObj;
      setExamQuestions(updated);
      setEditingQuestionIdx(null);
    } else {
      setExamQuestions([...examQuestions, questionObj]);
    }

    // Reset single question inputs
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrect(0);
  };

  // Edit Question from current list
  const handleStartEditQuestion = (idx) => {
    const q = examQuestions[idx];
    setQText(q.q || '');
    setQType(q.type || 'mcq');
    if (q.type === 'mcq') {
      setQOptA(q.options?.[0] || '');
      setQOptB(q.options?.[1] || '');
      setQOptC(q.options?.[2] || '');
      setQOptD(q.options?.[3] || '');
      setQCorrect(q.correct !== undefined ? q.correct : 0);
    } else if (q.type === 'tf') {
      setQCorrect(q.correct !== undefined ? q.correct : 0);
    }
    setEditingQuestionIdx(idx);
  };

  // Remove Question from current list
  const handleRemoveQuestion = (idxToRemove) => {
    setExamQuestions(examQuestions.filter((_, idx) => idx !== idxToRemove));
    if (editingQuestionIdx === idxToRemove) {
      setEditingQuestionIdx(null);
      setQText('');
      setQOptA('');
      setQOptB('');
      setQOptC('');
      setQOptD('');
      setQCorrect(0);
    } else if (editingQuestionIdx !== null && editingQuestionIdx > idxToRemove) {
      setEditingQuestionIdx(editingQuestionIdx - 1);
    }
  };

  // Submit Completed/Edited Exam
  const handleCreateExamSubmit = async (e) => {
    e.preventDefault();
    if (examQuestions.length === 0) {
      showAlert("الرجاء إضافة سؤال واحد على الأقل للاختبار!", "خطأ في بناء الاختبار");
      return;
    }
    setExamStatus('جاري حفظ الاختبار...');
    try {
      const finalCohort = (profile && profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق')
        ? profile.assignedCohort
        : examCohort;
      const finalMajor = (profile && profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات')
        ? profile.assignedMajor
        : examMajor;
      const examData = {
        title: examTitle,
        duration: parseInt(examDuration),
        cohort: finalCohort,
        major: finalMajor,
        questions: examQuestions,
        startDate: examStartDate || null,
        endDate: examEndDate || null
      };

      if (editingExamId) {
        const examDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'exams', editingExamId);
        await updateDoc(examDocRef, examData);
        logAdminAction('تعديل اختبار', `تم تعديل الاختبار: ${examTitle}`);
        setExamStatus('تم تحديث وتعديل الاختبار بنجاح! ✏️');
        setEditingExamId(null);
      } else {
        const examRef = collection(db, 'artifacts', appId, 'public', 'data', 'exams');
        await addDoc(examRef, examData);
        logAdminAction('إضافة اختبار', `تم إضافة اختبار جديد: ${examTitle}`);
        setExamStatus('تم بناء وتعميم الاختبار التجريبي للطلاب بنجاح! 🎓');
      }

      setExamTitle('');
      setExamDuration(15);
      setExamQuestions([]);
      setExamStartDate('');
      setExamEndDate('');
    } catch (err) {
      setExamStatus('خطأ: ' + err.message);
    }
    setTimeout(() => setExamStatus(''), 4000);
  };

  // Create / Register New Exam Schedule
  const handleAddScheduleSubmit = async (e) => {
    e.preventDefault();
    if (schedExams.length === 0) {
      showAlert("الرجاء إضافة مادة واحدة على الأقل للجدول!", "خطأ في بناء الجدول");
      return;
    }
    setSchedStatus('جاري حفظ واعتماد الجدول...');
    try {
      const finalCohort = (profile && profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق')
        ? profile.assignedCohort
        : schedCohort;
      const finalMajor = (profile && profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات')
        ? profile.assignedMajor
        : schedMajor;

      const schedData = {
        title: schedTitle,
        type: schedType,
        cohort: finalCohort,
        major: finalMajor,
        notes: schedNotes,
        exams: schedExams,
        visible: true,
        createdAt: serverTimestamp(),
        addedBy: profile.name
      };

      const schedRef = collection(db, 'artifacts', appId, 'public', 'data', 'exam_schedules');
      await addDoc(schedRef, schedData);

      logAdminAction('إضافة جدول امتحانات', `تمت إضافة جدول: ${schedTitle}`);
      setSchedStatus('تم اعتماد وإصدار الجدول للطلاب بنجاح! 📅');

      setSchedTitle('');
      setSchedNotes('');
      setSchedExams([]);
    } catch (err) {
      setSchedStatus('خطأ: ' + err.message);
    }
    setTimeout(() => setSchedStatus(''), 4000);
  };

  const handleToggleScheduleVisibility = async (schedId, currentVisibility) => {
    try {
      const schedRef = doc(db, 'artifacts', appId, 'public', 'data', 'exam_schedules', schedId);
      await updateDoc(schedRef, { visible: !currentVisibility });
      logAdminAction(currentVisibility ? 'إخفاء جدول' : 'إظهار جدول', `تم تغيير حالة ظهور الجدول: ${schedId}`);
    } catch (e) {
      showAlert("خطأ في تغيير حالة الجدول: " + e.message, "فشل الإجراء");
    }
  };

  const handleDeleteSchedule = async (schedId) => {
    showConfirm("هل أنت متأكد من حذف هذا الجدول نهائياً؟", async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exam_schedules', schedId));
      logAdminAction('حذف جدول امتحانات', `تم حذف جدول: ${schedId}`);
    }, "تأكيد حذف الجدول");
  };

  // Create / Register New Staff Member from Admin cockpit
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword.trim()) {
      setNewStaffStatus('خطأ: يرجى ملء كافة الخانات المطلوبة!');
      return;
    }
    setNewStaffStatus('جاري تسجيل الحساب...');

    const secondaryApp = initializeApp(firebaseConfig, 'SecondaryStaffApp');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStaffEmail, newStaffPassword);
      const newUid = userCredential.user.uid;

      const userDocRef = doc(db, 'artifacts', appId, 'users', newUid, 'profile', 'details');
      await setDoc(userDocRef, {
        name: newStaffName,
        email: newStaffEmail,
        uid: newUid,
        studentId: `STAFF-${Math.floor(1000 + Math.random() * 9000)}`,
        role: newStaffRole,
        assignedCohort: newStaffCohort,
        assignedMajor: newStaffMajor,
        cohort: 'أعضاء هيئة التدريس',
        major: 'مساعد أكاديمي',
        bio: newStaffRole === 'admin' ? 'مدير نظام 🛡️' : 'مساعد مشرف 🎖️',
        avatarUrl: '',
        createdAt: new Date().toISOString()
      });

      const publicDirRef = doc(db, 'artifacts', appId, 'public', 'data', 'student_directory', newUid);
      await setDoc(publicDirRef, {
        name: newStaffName,
        email: newStaffEmail,
        studentId: 'STAFF',
        gender: 'ذكر',
        role: newStaffRole,
        assignedCohort: newStaffCohort,
        assignedMajor: newStaffMajor,
        phone: 'لا يوجد'
      });

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffStatus('تمت إضافة العضو الإداري الجديد بنجاح! 🎉');
    } catch (err) {
      console.error(err);
      setNewStaffStatus('خطأ: ' + err.message);
    } finally {
      await secondaryApp.delete();
    }
    setTimeout(() => setNewStaffStatus(''), 5000);
  };

  // Handle Essay grading submission
  const handleSubmitEssayGrading = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;

    // Calculate total essay grade
    let additionalEssayScore = 0;
    Object.keys(essayGradeInput).forEach(idx => {
      additionalEssayScore += Number(essayGradeInput[idx] || 0);
    });

    const finalScore = selectedSub.score + additionalEssayScore;

    try {
      // 1. Update global submission record
      const globalRef = doc(db, 'artifacts', appId, 'exam_submissions', `${selectedSub.studentUid}_${selectedSub.examId}`);
      await updateDoc(globalRef, {
        status: 'graded',
        essayGrades: essayGradeInput,
        essayFeedback: essayFeedbackText,
        finalScore: finalScore
      });

      // 2. Update student's local record
      const studentLocalRef = doc(db, 'artifacts', appId, 'users', selectedSub.studentUid, 'exam_submissions', selectedSub.examId);
      await updateDoc(studentLocalRef, {
        status: 'graded',
        essayGrades: essayGradeInput,
        essayFeedback: essayFeedbackText,
        finalScore: finalScore
      });

      showAlert(`تم رصد الدرجة الكلية بنجاح للممتحن (${selectedSub.studentName}) لتصبح: ${finalScore} من ${selectedSub.total}`, "اكتمل الرصد والاعتماد 🏆");
      setSelectedSub(null);
      setEssayGradeInput({});
      setEssayFeedbackText('');
    } catch (err) {
      console.error("Error saving essay grades:", err);
      showAlert("حدث خطأ أثناء رصد الدرجات بقاعدة البيانات.", "فشل الرصد ❌");
    }
  };

  // Database Seed Action
  const handleSeedDatabase = async () => {
    showConfirm("هل تريد ملء قاعدة البيانات ببيانات تجريبية كاملة؟", async () => {
      try {
        const materialsRef = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
        const announcementsRef = collection(db, 'artifacts', appId, 'public', 'data', 'announcements');
        const examsRef = collection(db, 'artifacts', appId, 'public', 'data', 'exams');

        // Seed Material Samples
        const materialsSeed = [
          { title: 'كتاب هياكل البيانات الخوارزمية المعتمد', type: 'pdf', cohort: COHORTS[0], major: MAJORS[0], url: 'https://w3schools.com', addedBy: 'المطور' },
          { title: 'شرح فيديو عملي للبرمجة كائنية التوجه OOP', type: 'video', cohort: COHORTS[0], major: MAJORS[0], url: 'https://youtube.com', addedBy: 'المطور' },
          { title: 'ملخص كبسولة الفاينال - نظم تشغيل الحاسب', type: 'final_review', cohort: COHORTS[0], major: MAJORS[0], url: 'https://w3schools.com', addedBy: 'المطور' }
        ];
        for (const m of materialsSeed) {
          await addDoc(materialsRef, { ...m, createdAt: serverTimestamp() });
        }

        // Seed Announcement Samples
        const announcementsSeed = [
          { msg: 'تنبيه: تم رفع نماذج امتحانات البابل شيت والمواد الدراسية الجديدة بمقرر الفرقة الأولى.', cohort: COHORTS[0], addedBy: 'شؤون الإدارة' },
          { msg: 'إعلان: بدء محاضرات المراجعة النهائية بمدرج تكنولوجيا المعلومات السبت المقبل.', cohort: COHORTS[1] || COHORTS[0], addedBy: 'رئيس القسم' }
        ];
        for (const a of announcementsSeed) {
          await addDoc(announcementsRef, { ...a, createdAt: serverTimestamp() });
        }

        showAlert("تمت تهيئة قاعدة البيانات بالبيانات النموذجية بنجاح!", "تهيئة ناجحة");
      } catch (e) {
        showAlert("خطأ: " + e.message, "فشل التهيئة");
      }
    }, "تهيئة البيانات");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center space-y-4">
        <RefreshCw className="text-[#0e5e6f] dark:text-yellow-500 animate-spin" size={48} />
        <h2 className="text-xl font-bold text-[#072327] dark:text-slate-300">جاري تحميل لوحة تحكم المسؤول...</h2>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="admin-card w-full max-w-md p-8 text-right shadow-2xl relative overflow-hidden border border-yellow-500/25">

          <div className="absolute -top-20 -right-20 w-44 h-44 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-[#bfebd4]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl border border-yellow-400">
              <ShieldAlert size={36} />
            </div>
          </div>

          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200 text-center mb-2">
            {isLogin ? 'بوابة المشرفين والمساعدين' : 'تسجيل حساب مسؤول جديد'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-8 font-bold">
            {isLogin ? 'تسجيل الدخول للموظفين والمسؤولين التقنيين بمعهد طيبة' : 'أنشئ حسابك لإدارة وتسيير المبادرة الطلابية'}
          </p>

          {authError && (
            <div className="mb-6 p-4 bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-bold rounded-2xl flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="shrink-0 text-rose-400" size={16} />
              <span>{authError}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs font-bold rounded-2xl flex items-start gap-2 leading-relaxed">
              <Check className="shrink-0 text-emerald-400" size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">البريد الإلكتروني المهني</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@taiba.edu.eg"
                className="w-full px-4 py-3 rounded-2xl admin-input font-bold text-sm text-left focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">كلمة مرور لوحة التحكم</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl admin-input font-bold text-sm text-left focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 btn-gold text-slate-950 font-black text-sm rounded-2xl transition active:scale-95 shadow-md flex items-center justify-center gap-2 mt-6 cursor-pointer"
            >
              {loginLoading ? <RefreshCw className="animate-spin" size={16} /> : 'تسجيل دخول كمسؤول 🛡️'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-white/5 pt-4">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider">
              Powered by Systems Architect - ENG/lol
            </span>
          </div>

        </div>
      </div>
    );
  }

  // ADMIN APPLICATION MAIN COCKPIT
  const unreadAdminGroupCount = adminGroupMessages.filter(m => m.senderId !== profile?.uid && (m.timestamp?.toMillis() || 0) > lastSeenAdminGroupChat).length;
  const allowedCohortsForProfile = profile?.role === 'admin'
    ? COHORTS
    : (profile?.allowedCohorts && profile.allowedCohorts.length > 0 ? profile.allowedCohorts : COHORTS);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      {/* Disclaimer Moving Ticker Bar */}
      <div className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 text-white text-xs font-black py-2.5 px-4 shadow-md flex items-center justify-between gap-4 z-[999] select-none shrink-0 overflow-hidden" dir="rtl">
        <span className="bg-white text-rose-700 px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 animate-pulse border border-red-250 flex items-center gap-1 shadow-sm z-10">
          🚨 تنبيه وإخلاء مسؤولية هام
        </span>
        <div className="flex-1 overflow-hidden relative" dir="ltr">
          <div className="animate-marquee-right whitespace-nowrap flex text-white font-black text-xs md:text-sm pt-0.5">
            <span className="px-16 inline-block">
              ⚠️ هذا الموقع مستقل تماماً وغير مرتبط بأي شكل من الأشكال بمعهد طيبة الأكاديمي أو إدارته نهائياً، ولا يمثل أي جهة رسمية أو تعاملات رسمية للمعهد • المنصة تم تطويرها بمبادرة طلابية مستقلة لمساعدة زملائنا الطلاب بكافة التخصصات الدراسية مجاناً • نهدف لتجميع وتسهيل دراسة المقررات الأكاديمية والمراجعات لتوصيل الفهم والمعلومة للطالب الكريم وليس لنا أي صلة رسمية بإدارة معهد طيبة العالي للحاسب والعلوم الإدارية.
            </span>
            <span className="px-16 inline-block">
              ⚠️ هذا الموقع مستقل تماماً وغير مرتبط بأي شكل من الأشكال بمعهد طيبة الأكاديمي أو إدارته نهائياً، ولا يمثل أي جهة رسمية أو تعاملات رسمية للمعهد • المنصة تم تطويرها بمبادرة طلابية مستقلة لمساعدة زملائنا الطلاب بكافة التخصصات الدراسية مجاناً • نهدف لتجميع وتسهيل دراسة المقررات الأكاديمية والمراجعات لتوصيل الفهم والمعلومة للطالب الكريم وليس لنا أي صلة رسمية بإدارة معهد طيبة العالي للحاسب والعلوم الإدارية.
            </span>
          </div>
        </div>
      </div>

      {/* Top Header Navbar */}
      <header className="sidebar-panel border-b px-6 py-4 flex items-center justify-between relative z-10 shadow-md">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Toggle on Mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-[#1a8e9e]/10 border border-[#1a8e9e]/30 dark:bg-slate-800 dark:border-slate-700 text-[#0e5e6f] dark:text-slate-300 transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
            title="القائمة"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center shadow-lg border border-[#0e5e6f]/50 shrink-0 overflow-hidden">
            <img src="/logo.jpg" alt="Platform Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <div>
            <h1 className="text-sm sm:text-md font-black text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-yellow-300 dark:to-yellow-500 line-clamp-1">
              لوحة تحكم طلاب معهد طيبة
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              مرحباً: {profile.name} ({profile.role === 'admin' ? 'مدير المنصة' : 'مساعد مشرف'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell for Admin Mentions */}
          <div className="relative">
            <button
              onClick={() => setNotiDropdownOpen(!notiDropdownOpen)}
              className="p-2 rounded-xl bg-[#bfebd4]/35 hover:bg-[#bfebd4]/60 text-[#0e5e6f] dark:text-[#bfebd4] transition relative cursor-pointer flex items-center justify-center border border-[#82af96]/30"
              title="تنبيهات المنشن والذكر"
            >
              <Bell size={16} />
              {adminMentions.filter(m => !m.read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce shadow-md">
                  {adminMentions.filter(m => !m.read).length}
                </span>
              )}
            </button>

            {/* Mentions Dropdown Modal */}
            {notiDropdownOpen && (
              <div className="absolute left-0 mt-2.5 w-72 md:w-80 bg-white dark:bg-[#09171a] border-2 border-[#82af96] dark:border-[#3c6550] rounded-2xl shadow-2xl p-4 z-[999] overflow-hidden" dir="rtl">
                <h4 className="font-black text-xs md:text-sm text-[#0e5e6f] dark:text-[#bfebd4] mb-3 border-b-2 border-[#82af96]/30 pb-2 flex justify-between items-center">
                  <span>🔔 إشارات ذكرك (Mentions)</span>
                  <button
                    onClick={async () => {
                      // Mark all as read
                      adminMentions.forEach(async (m) => {
                        if (!m.read) {
                          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_mentions', m.id), { read: true });
                        }
                      });
                    }}
                    className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    تحديد الكل كمقروء
                  </button>
                </h4>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  {adminMentions.length === 0 ? (
                    <p className="text-xs text-slate-500 font-bold py-4 text-center">لا توجد إشارات ذكر حالياً.</p>
                  ) : (
                    adminMentions.map(m => (
                      <div
                        key={m.id}
                        onClick={async () => {
                          // Mark as read
                          if (!m.read) {
                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_mentions', m.id), { read: true });
                          }
                          setNotiDropdownOpen(false);
                          // Navigate to chat cohort
                          setAdminChatCohort(m.cohort);
                          setAdminChatMajor(m.major);
                          setCurrentTab('admin_chat');
                        }}
                        className={`p-2.5 rounded-xl border transition cursor-pointer text-right flex flex-col gap-1
                            ${m.read
                            ? 'bg-slate-50/50 dark:bg-black/10 border-slate-200 dark:border-slate-800'
                            : 'bg-amber-500/10 border-amber-300 dark:border-amber-700 hover:bg-amber-500/25'}
                          `}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-[#0e5e6f] dark:text-[#bfebd4]">
                            👤 {m.mentionerName}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-black/45 px-1.5 py-0.5 rounded-md">
                            {m.cohort}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-800 dark:text-slate-300 font-medium line-clamp-2">
                          "{m.text}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="p-2 px-2.5 sm:px-3 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 transition flex items-center gap-1.5 text-xs font-black cursor-pointer"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col md:flex-row relative">

        {/* Backdrop overlay for mobile drawer */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          />
        )}

        {/* Sidebar Menu Panel */}
        <aside className={`w-72 md:w-64 sidebar-panel p-4 space-y-2 flex flex-col fixed md:relative top-[73px] md:top-0 bottom-0 md:bottom-auto right-0 z-40 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}>

          <button
            onClick={() => setCurrentTab('overview')}
            className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'overview' ? 'active' : ''}`}
          >
            <span className="flex items-center gap-2.5">
              <Activity size={16} /> الإحصائيات العامة
            </span>
          </button>

          {(profile.role === 'admin' || (profile.role === 'helper' && profile.permissions?.canManageStudents)) && (
            <button
              onClick={() => setCurrentTab('students')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'students' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <Users size={16} /> شؤون الطلاب (الأكاديمية)
              </span>
              <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-black">
                {students.filter(s => !s.role || s.role === 'student').length}
              </span>
            </button>
          )}

          {profile.role === 'admin' && (
            <button
              onClick={() => setCurrentTab('staff')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'staff' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <Shield size={16} /> طاقم الإشراف والمساعدين
              </span>
              <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-black">
                {students.filter(s => s.role === 'admin' || s.role === 'helper').length}
              </span>
            </button>
          )}

          {(profile.role === 'admin' || (profile.role === 'helper' && profile.permissions?.canManageChat)) && (
            <button
              onClick={() => setCurrentTab('admin_chat')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'admin_chat' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <MessageCircle size={16} /> الشات الجامعي
              </span>
              {unreadAdminGroupCount > 0 && (
                <span className="bg-rose-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shrink-0 shadow-md">
                  {unreadAdminGroupCount}
                </span>
              )}
            </button>
          )}

          {(profile.role === 'admin' || (profile.role === 'helper' && profile.permissions?.canManageReports)) && (
            <button
              onClick={() => setCurrentTab('reports')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'reports' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <Flag size={16} /> الرقابة والبلاغات (شات وحسابات)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${chatReports.length > 0 || getFilteredReports().length > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-500/20 text-slate-400'}`}>
                {chatReports.length + getFilteredReports().length}
              </span>
            </button>
          )}

          {(profile.role === 'admin' || (profile.role === 'helper' && profile.permissions?.canUploadMaterials)) && (
            <button
              onClick={() => setCurrentTab('materials')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'materials' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <FileText size={16} /> إدارة المقررات والملخصات
              </span>
              <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-black">{materials.length}</span>
            </button>
          )}

          <button
            onClick={() => setCurrentTab('announcements')}
            className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'announcements' ? 'active' : ''}`}
          >
            <span className="flex items-center gap-2.5">
              <Megaphone size={16} /> بث الإعلانات والتنبيهات
            </span>
            <span className="bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full text-[10px] font-black">{announcements.length}</span>
          </button>

          {(profile.role === 'admin' || (profile.role === 'helper' && profile.permissions?.canUploadExams)) && (
            <>
              <button
                onClick={() => setCurrentTab('exams')}
                className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'exams' ? 'active' : ''}`}
              >
                <span className="flex items-center gap-2.5">
                  <FileQuestion size={16} /> صانع الامتحانات والبابل شيت
                </span>
                <span className="bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full text-[10px] font-black">{exams.length}</span>
              </button>

              <button
                onClick={() => setCurrentTab('results')}
                className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'results' ? 'active' : ''}`}
              >
                <span className="flex items-center gap-2.5">
                  <GraduationCap size={16} /> نتائج الطلاب وتصحيح المقالي
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${submissions.filter(s => s.status === 'pending').length > 0
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                  {submissions.length}
                </span>
              </button>
            </>
          )}

          {/* Removed Firebase Data Initialization button as per request */}

          {(profile.role === 'admin' || (profile.role === 'helper' && profile.permissions?.canUploadSchedules)) && (
            <button
              onClick={() => setCurrentTab('schedules')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'schedules' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <Calendar size={16} /> جداول الامتحانات
              </span>
              <span className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[10px] font-black">{schedules.length}</span>
            </button>
          )}

          {profile.role === 'admin' && (
            <button
              onClick={() => setCurrentTab('logs')}
              className={`w-full p-3.5 flex items-center justify-between text-xs font-black sidebar-btn ${currentTab === 'logs' ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <FileText size={16} /> سجل نشاطات الإدارة (Logs)
              </span>
              <span className="bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-black">{logs.length}</span>
            </button>
          )}

        </aside>

        {/* Content Body Pane */}
        <main className="flex-1 p-6 overflow-y-auto text-right bg-transparent transition-all duration-300">

          {/* TAB 1: OVERVIEW */}
          {currentTab === 'overview' && (
            <div className="space-y-6 fade-in">
              <h2 className="text-xl font-black border-r-4 border-yellow-500 pr-3 gradient-text-gold">لوحة الإحصائيات العامة</h2>

              <div className={`grid grid-cols-1 sm:grid-cols-2 ${profile.role === 'admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>

                <div className="admin-card p-6 flex flex-col justify-between min-h-[120px]">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-widest uppercase">الطلاب المسجلين</span>
                  <span className="block text-3xl font-black text-yellow-600 dark:text-yellow-500 mt-2">
                    {profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق'
                      ? students.filter(s => (!s.role || s.role === 'student') && s.cohort === profile.assignedCohort).length
                      : students.filter(s => !s.role || s.role === 'student').length} طالب
                  </span>
                </div>

                <div className="admin-card p-6 flex flex-col justify-between min-h-[120px]">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-widest uppercase">المقررات والمناهج</span>
                  <span className="block text-3xl font-black text-[#0e5e6f] dark:text-[#bfebd4] mt-2">
                    {getFilteredMaterials().length} ملف
                  </span>
                </div>

                <div className="admin-card p-6 flex flex-col justify-between min-h-[120px]">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-widest uppercase">الاختبارات الفعالة</span>
                  <span className="block text-3xl font-black text-[#1a8e9e] mt-2">
                    {getFilteredExams().length} اختبار
                  </span>
                </div>

                <div className="admin-card p-6 flex flex-col justify-between min-h-[120px]">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-widest uppercase">البلاغات المعلقة</span>
                  <span className={`block text-3xl font-black mt-2 ${getFilteredReports().length + chatReports.length > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {getFilteredReports().length + chatReports.length} شكوى
                  </span>
                </div>

              </div>

              {/* Developer disclaimer card inside cockpit */}
              <div className="admin-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-amber-500/25">
                <div className="space-y-1">
                  <h4 className="text-md font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                    <Info size={16} /> تنبيه من مطور المنصة ENG / EL LOL
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
                    هذه اللوحة مخصصة لإدارة المقررات ومراقبة السلوك العام للطلاب بشكل منفصل تماماً، وهي مرتبطة بنفس خادم وقاعدة بيانات التطبيق الأصلي.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3.5 py-1.5 bg-[#bfebd4]/10 text-[#0e5e6f] dark:text-[#bfebd4] rounded-full text-[10px] font-black border border-[#bfebd4]/20" dir="ltr">
                    AppID: {appId}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS MANAGEMENT */}
          {currentTab === 'students' && profile.role === 'admin' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-black border-r-4 border-yellow-500 pr-3 gradient-text-gold">شؤون الطلاب وإدارة الحسابات الأكاديمية</h2>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث عن اسم، هاتف، أو رقم أكاديمي..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full sm:w-80 px-4 py-2.5 admin-input text-xs font-bold focus:outline-none"
                  />
                  <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={14} />
                </div>
              </div>

              <div className="admin-card p-4 overflow-x-auto">
                <table className="admin-table text-xs text-right">
                  <thead className="text-[#0e5e6f] dark:text-[#bfebd4] font-black">
                    <tr>
                      <th className="p-4">الاسم والبريد</th>
                      <th className="p-4">رقم الهاتف</th>
                      <th className="p-4">الرقم الأكاديمي</th>
                      <th className="p-4">الفرقة والتخصص</th>
                      <th className="p-4 text-center">الإجراءات والترقيات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter(s => !s.role || s.role === 'student')
                      .filter(s =>
                        s.name.includes(searchQuery) ||
                        (s.studentId && s.studentId.includes(searchQuery)) ||
                        (s.phone && s.phone.includes(searchQuery))
                      )
                      .map(student => (
                        <tr key={student.id}>
                          <td className="p-4 font-bold">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={student.avatarUrl || (student.gender === 'أنثى' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tiera' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Christian')}
                                alt=""
                                className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50"
                              />
                              <div>
                                <span className="block font-black flex items-center gap-1.5">
                                  {student.name}
                                  {student.isBanned && (
                                    <span className="px-1.5 py-0.5 bg-red-600/20 border border-red-500/30 text-red-500 dark:text-red-400 text-[8px] font-black rounded-md animate-pulse">
                                      🚫 محظور
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">{student.realEmail || student.email || 'لا يوجد بريد'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-extrabold text-[#0e5e6f] dark:text-[#bfebd4]" dir="ltr">
                            {student.realPhone || student.phone || 'لا يوجد هاتف 📞'}
                          </td>
                          <td className="p-4 font-extrabold text-[#0e5e6f] dark:text-[#bfebd4]" dir="ltr">{student.studentId || 'N/A'}</td>
                          <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                            {student.cohort} <br />
                            <span className="text-[10px] text-slate-500">{student.major}</span>
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => handleUpdateRole(student.id, 'admin')}
                              className="px-2.5 py-1.5 btn-rose rounded-xl font-black text-[9px] cursor-pointer hover:scale-105 active:scale-95 transition"
                            >
                              ترقية لمدير 👑
                            </button>
                            <button
                              onClick={() => handleUpdateRole(student.id, 'helper')}
                              className="px-2.5 py-1.5 btn-gold text-slate-900 rounded-xl font-black text-[9px] cursor-pointer hover:scale-105 active:scale-95 transition"
                            >
                              ترقية لمساعد 🎖️
                            </button>
                            <button
                              onClick={() => handleToggleBanStudent(student.id, student.name, student.isBanned)}
                              className={`px-2.5 py-1.5 border rounded-xl font-black text-[9px] cursor-pointer transition ${student.isBanned
                                ? 'bg-emerald-600/10 hover:bg-emerald-600/30 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-600/10 hover:bg-amber-600/30 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                }`}
                            >
                              {student.isBanned ? 'فك الحظر 🔓' : 'حظر الطالب 🚫'}
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id, student.name)}
                              className="px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-black text-[9px] cursor-pointer transition"
                            >
                              حذف الطالب ❌
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: STAFF MANAGEMENT */}
          {currentTab === 'staff' && profile.role === 'admin' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-black border-r-4 border-yellow-500 pr-3 gradient-text-gold">إدارة طاقم المشرفين والمساعدين</h2>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث عن مشرف..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full sm:w-80 px-4 py-2.5 admin-input text-xs font-bold focus:outline-none"
                  />
                  <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={14} />
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {/* Top part: Add New Staff Form */}
                <div className="admin-card p-6 space-y-4">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 gradient-text-gold">إضافة عضو طاقم جديد</h3>

                  <form onSubmit={handleAddStaffSubmit} className="space-y-4 text-right">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الاسم الكامل للمشرف/المساعد</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: أ. محمود محمد"
                        value={newStaffName}
                        onChange={e => setNewStaffName(e.target.value)}
                        className="w-full px-4 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">البريد الإلكتروني المهني</label>
                      <input
                        type="email"
                        required
                        placeholder="example@taiba.edu.eg"
                        value={newStaffEmail}
                        onChange={e => setNewStaffEmail(e.target.value)}
                        className="w-full px-4 py-2.5 admin-input font-bold text-xs text-left focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">كلمة مرور الحساب</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newStaffPassword}
                        onChange={e => setNewStaffPassword(e.target.value)}
                        className="w-full px-4 py-2.5 admin-input font-bold text-xs text-left focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">صلاحية ودور الموظف</label>
                      <select
                        value={newStaffRole}
                        onChange={e => setNewStaffRole(e.target.value)}
                        className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      >
                        <option value="helper">مساعد مشرف (Helper) - لا يمكنه مسح الطلاب أو إدارة الطاقم</option>
                        <option value="admin">مدير نظام كامل (Admin) - كافة الصلاحيات الإدارية</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الفرقة المسندة (اختصاص المشرف)</label>
                      <select
                        value={newStaffCohort}
                        onChange={e => setNewStaffCohort(e.target.value)}
                        className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      >
                        <option value="كل الفرق">كل الفرق الدراسية (وصول كامل) 🌐</option>
                        {COHORTS.map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">التخصص المسند (اختصاص المشرف)</label>
                      <select
                        value={newStaffMajor}
                        onChange={e => setNewStaffMajor(e.target.value)}
                        className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      >
                        <option value="كل التخصصات">كل التخصصات (وصول كامل) 🎓</option>
                        {MAJORS.map((m, i) => (
                          <option key={i} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 btn-gold text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer"
                    >
                      تسجيل وتفعيل الحساب 👑
                    </button>
                    {newStaffStatus && <p className="text-center text-xs font-black text-emerald-600 dark:text-emerald-400">{newStaffStatus}</p>}
                  </form>
                </div>

                {/* Bottom part: Staff Directory List Table */}
                <div className="admin-card p-4 overflow-x-auto">
                  <table className="admin-table text-xs text-right">
                    <thead className="text-[#0e5e6f] dark:text-[#bfebd4] font-black">
                      <tr>
                        <th className="p-4">الاسم والبريد</th>
                        <th className="p-4">الرقم التعريفي</th>
                        <th className="p-4">الاسم المستعار (Nickname)</th>
                        <th className="p-4">الفرقة والتخصص</th>
                        <th className="p-4">صلاحيات المساعد</th>
                        <th className="p-4 text-center">الرتبة والإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students
                        .filter(s => s.role === 'admin' || s.role === 'helper')
                        .filter(s =>
                          s.name.includes(searchQuery) ||
                          (s.studentId && s.studentId.includes(searchQuery))
                        )
                        .map(staff => (
                          <tr key={staff.id}>
                            <td className="p-4 font-bold">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={staff.avatarUrl || (staff.gender === 'أنثى' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tiera' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Christian')}
                                  alt=""
                                  className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50"
                                />
                                <div>
                                  <span className="block font-black">{staff.name}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{staff.realEmail || staff.email || 'لا يوجد بريد'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-extrabold text-[#0e5e6f] dark:text-[#bfebd4]" dir="ltr">{staff.studentId || 'N/A'}</td>
                            <td className="p-4">
                              <input
                                type="text"
                                placeholder="الدعم الفني..."
                                value={staff.adminNickname || ''}
                                onChange={(e) => {
                                  // Update locally first for smooth UI
                                  const newStaff = [...students];
                                  const idx = newStaff.findIndex(s => s.id === staff.id);
                                  if (idx > -1) {
                                    newStaff[idx].adminNickname = e.target.value;
                                    setStudents(newStaff);
                                  }
                                }}
                                onBlur={(e) => handleUpdateStaffNickname(staff.id, e.target.value)}
                                className="w-24 px-2 py-1.5 rounded-lg admin-input font-black text-[9px] focus:outline-none"
                              />
                            </td>
                            <td className="p-4 space-y-2">
                              <select
                                value={staff.assignedCohort || 'كل الفرق'}
                                onChange={(e) => handleUpdateStaffCohort(staff.id, e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg admin-input font-black text-[9px] focus:outline-none mb-2"
                              >
                                <option value="كل الفرق">كل الفرق 🌐</option>
                                {COHORTS.map((c, i) => (
                                  <option key={i} value={c}>{c}</option>
                                ))}
                              </select>
                              <select
                                value={staff.assignedMajor || 'كل التخصصات'}
                                onChange={(e) => handleUpdateStaffMajor(staff.id, e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg admin-input font-black text-[9px] focus:outline-none"
                              >
                                <option value="كل التخصصات">كل التخصصات 🎓</option>
                                {MAJORS.map((m, i) => (
                                  <option key={i} value={m}>{m}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-4">
                              {staff.role === 'helper' ? (
                                <div className="space-y-1 text-[9px] font-bold">
                                  {['canUploadMaterials', 'canUploadExams', 'canUploadSchedules', 'canManageChat', 'canManageAnnouncements', 'canManageStudents', 'canManageReports'].map(permKey => {
                                    const labels = {
                                      canUploadMaterials: 'المحاضرات 📚',
                                      canUploadExams: 'الامتحانات 📝',
                                      canUploadSchedules: 'الجداول 📅',
                                      canManageChat: 'الشات 💬',
                                      canManageAnnouncements: 'الإعلانات 📢',
                                      canManageStudents: 'الطلاب 👥',
                                      canManageReports: 'الرقابة 🚩'
                                    };
                                    return (
                                      <label key={permKey} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={staff.permissions?.[permKey] || false}
                                          onChange={(e) => {
                                            const newPerms = { ...(staff.permissions || {}), [permKey]: e.target.checked };
                                            handleUpdateStaffPermissions(staff.id, newPerms);
                                          }}
                                          className="accent-[#0e5e6f]"
                                        />
                                        <span>{labels[permKey]}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[10px] text-emerald-500 font-bold italic">وصول كامل</span>
                              )}
                            </td>
                            <td className="p-4 space-y-2">
                              <div className="flex justify-center">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black ${staff.role === 'admin'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  }`}>
                                  {staff.role === 'admin' ? 'مدير نظام 🛡️' : 'مساعد مشرف 🎖️'}
                                </span>
                              </div>
                              <div className="flex justify-center gap-1 flex-wrap max-w-[120px] mx-auto">
                                {staff.id !== user.uid ? (
                                  <>
                                    {staff.role === 'helper' && (
                                      <button
                                        onClick={() => handleUpdateRole(staff.id, 'admin')}
                                        className="px-2 py-1.5 btn-rose rounded-xl font-black text-[9px] cursor-pointer hover:scale-105 active:scale-95 transition"
                                      >
                                        ترقية لمدير
                                      </button>
                                    )}
                                    {staff.role === 'admin' && (
                                      <button
                                        onClick={() => handleUpdateRole(staff.id, 'helper')}
                                        className="px-2 py-1.5 btn-gold text-slate-900 rounded-xl font-black text-[9px] cursor-pointer hover:scale-105 active:scale-95 transition"
                                      >
                                        تنزيل لمساعد
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleUpdateRole(staff.id, 'student')}
                                      className="px-2 py-1.5 btn-teal rounded-xl font-black text-[9px] cursor-pointer hover:scale-105 active:scale-95 transition"
                                    >
                                      سحب الصلاحيات
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold italic block mt-1">حسابك (نشط)</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REPORTS SYSTEM */}
          {currentTab === 'reports' && (profile.role === 'admin' || profile.role === 'helper') && (
            <div className="space-y-6 fade-in">
              <h2 className="text-xl font-black border-r-4 border-yellow-500 pr-3 gradient-text-gold">الرقابة والبلاغات في الشات</h2>

              {chatReports.length === 0 ? (
                <div className="admin-card p-12 text-center text-slate-500 dark:text-slate-400 font-bold">
                  🎉 لا توجد أي بلاغات مسجلة حالياً! بيئة الشات نظيفة تماماً.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {chatReports.map((report) => (
                    <div key={report.id} className="admin-card p-6 space-y-4 text-right">
                      <div className="flex justify-between items-center border-b border-[#0e5e6f]/15 dark:border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black">مقدّم البلاغ:</span>
                          <span className="block font-black text-[#0e5e6f] dark:text-[#bfebd4] text-xs">{report.reporterName}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black">صاحب الرسالة:</span>
                          <span className="block font-black text-rose-600 dark:text-rose-400 text-xs">{report.senderName}</span>
                        </div>
                      </div>

                      <div className="bg-slate-500/5 dark:bg-slate-950/40 p-4 rounded-xl border border-[#0e5e6f]/10 dark:border-slate-800 text-xs leading-relaxed font-bold text-slate-700 dark:text-slate-200">
                        <p className="text-slate-500 text-[10px] mb-1">محتوى الرسالة المسيئة:</p>
                        <p className="mb-3 text-sm">"{report.messageText}"</p>
                        <hr className="border-slate-300 dark:border-slate-700 mb-3" />
                        💬 <strong>سبب الإبلاغ:</strong> {report.reason}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 gap-2">
                        <span>الفرقة: {report.cohort}</span>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chat_reports', report.id));
                                logAdminAction('تجاهل بلاغ شات', `تم تجاهل بلاغ من ${report.reporterName} ضد رسالة ${report.senderName}`);
                                showAlert('تم مسح البلاغ وإغلاقه بنجاح.');
                              } catch (e) { console.error(e); }
                            }}
                            className="flex-1 px-3 py-2 btn-teal text-white rounded-xl font-black cursor-pointer hover:scale-105 active:scale-95 transition"
                          >
                            تجاهل ومسح
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                // 1. Try to delete the original message safely
                                try {
                                  const cSafe = (report.cohort || '').replace(/\s+/g, '_');
                                  const mSafe = (report.major || 'عام').replace(/\s+/g, '_');
                                  const collName = report.chatCollection || `chat_${cSafe}_${mSafe}`;
                                  if (collName && report.messageId) {
                                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collName, report.messageId));
                                  }
                                } catch (msgErr) {
                                  console.warn("Could not delete original message, it might not exist:", msgErr);
                                }

                                // 2. Delete the report document itself (guaranteed to run)
                                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chat_reports', report.id));

                                logAdminAction('حذف رسالة وبلاغ', `تم حذف الرسالة المسيئة وإغلاق البلاغ بنجاح.`);
                                showAlert('تم حذف الرسالة الأصلية من الشات ومسح البلاغ بنجاح.', 'تم الحذف 🗑️');
                              } catch (e) {
                                console.error("Failed to delete report:", e);
                                showAlert('حدث خطأ أثناء حذف البلاغ.');
                              }
                            }}
                            className="flex-1 px-3 py-2 btn-rose text-white rounded-xl font-black cursor-pointer hover:scale-105 active:scale-95 transition"
                          >
                            حذف الرسالة والبلاغ 🚫
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: ADMIN CHAT */}
          {currentTab === 'admin_chat' && (profile.role === 'admin' || profile.role === 'helper') && (
            <div className="space-y-6 fade-in h-[calc(100vh-120px)] flex flex-col">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-black border-r-4 border-[#0e5e6f] pr-3 text-[#0e5e6f] dark:text-[#bfebd4]">الشات الجامعي والإشراف المباشر</h2>
                <div className="flex gap-2">
                  <select
                    value={adminChatCohort}
                    onChange={(e) => setAdminChatCohort(e.target.value)}
                    className="admin-input text-sm font-bold p-2 w-48"
                  >
                    {allowedCohortsForProfile.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={adminChatMajor}
                    onChange={(e) => setAdminChatMajor(e.target.value)}
                    className="admin-input text-sm font-bold p-2 w-48"
                  >
                    {MAJORS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {/* 
                    We pass a mock profile to AdminChatView so it treats us as an admin 
                    belonging to the currently selected cohort and major
                  */}
                <AdminChatView
                  profile={{ ...profile, cohort: adminChatCohort, major: adminChatMajor }}
                  groupMessages={adminGroupMessages}
                  privateMessages={[]}
                  friendships={[]}
                  studentDirectory={students}
                />
              </div>
            </div>
          )}

          {/* TAB 4: MATERIALS */}
          {currentTab === 'materials' && (
            <div className="space-y-6 fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Form Add Material */}
                <div className="admin-card p-6 space-y-4">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 gradient-text-gold">نشر وتعميم ملف جديد</h3>

                  <form onSubmit={handleAddMaterialSubmit} className="space-y-3.5 text-right">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">عنوان الملف</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: مراجعة هندسة الحاسوب"
                        value={matTitle}
                        onChange={e => setMatTitle(e.target.value)}
                        className="w-full px-4 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1.5">طريقة إرفاق الملف الدراسي</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-500/10 rounded-xl mb-3">
                        <button
                          type="button"
                          onClick={() => setUploadMode('link')}
                          className={`py-1.5 rounded-lg text-[10px] font-black transition ${uploadMode === 'link'
                            ? 'bg-yellow-500 text-slate-950 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-350'
                            }`}
                        >
                          رابط خارجي (Drive) 🔗
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMode('file')}
                          className={`py-1.5 rounded-lg text-[10px] font-black transition ${uploadMode === 'file'
                            ? 'bg-yellow-500 text-slate-950 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-355'
                            }`}
                        >
                          رفع ملف PDF مباشر 📁
                        </button>
                      </div>
                    </div>

                    {uploadMode === 'link' ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الرابط الأكاديمي (URL)</label>
                        <input
                          type="url"
                          placeholder="https://drive.google.com/..."
                          value={matUrl}
                          onChange={e => setMatUrl(e.target.value)}
                          className="w-full px-4 py-2.5 admin-input font-bold text-xs text-left focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">اختيار ملف PDF من جهازك</label>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handlePdfChange}
                          className="w-full px-3 py-2 bg-slate-500/5 dark:bg-slate-950/40 border border-[#0e5e6f]/25 dark:border-slate-800 rounded-xl font-bold text-[10px] focus:outline-none text-slate-200"
                        />
                        <span className="block text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                          💡 أقصى حجم مسموح: 22 ميجابايت (يُرفع سحابياً مجزأً فوريًا).
                        </span>
                        {matPdfBase64 && (
                          <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-black">
                            ✓ تم معالجة وتجهيز ملف الـ PDF بنجاح!
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الفرقة</label>
                        <select
                          value={profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق' ? profile.assignedCohort : matCohort}
                          onChange={e => setMatCohort(e.target.value)}
                          disabled={profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق'}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none disabled:opacity-70"
                        >
                          {allowedCohortsForProfile.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">التخصص</label>
                        <select
                          value={profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات' ? profile.assignedMajor : matMajor}
                          onChange={e => setMatMajor(e.target.value)}
                          disabled={profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات'}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none disabled:opacity-70"
                        >
                          {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">القسم والتصنيف</label>
                      <select
                        value={matType}
                        onChange={e => setMatType(e.target.value)}
                        className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      >
                        <option value="pdf">كتاب أو ملف PDF تفصيلي</option>
                        <option value="video">فيديو شرح تفاعلي</option>
                        <option value="summary">ملخص البابل شيت والمراجعة</option>
                        <option value="midterm_review">مراجعة الميدتيرم (تبويب المراجعات)</option>
                        <option value="final_review">مراجعة نهاية الفصل الفاينال (تبويب المراجعات)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 btn-gold text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer"
                    >
                      بث وتعميم الملف الدراسي 🍉
                    </button>
                    {matStatus && <p className="text-center text-xs font-black text-emerald-600 dark:text-emerald-400">{matStatus}</p>}
                  </form>
                </div>

                {/* Materials List */}
                <div className="lg:col-span-2 admin-card p-6 overflow-hidden flex flex-col">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 mb-4 gradient-text-gold">قائمة المقررات المرفوعة حالياً</h3>

                  <div className="flex-1 overflow-y-auto space-y-3 max-h-[480px] pr-1">
                    {getFilteredMaterials().map((mat) => (
                      <div key={mat.id} className="p-4 bg-slate-500/5 dark:bg-slate-950/40 border border-[#0e5e6f]/10 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs font-bold transition hover:scale-[1.01]">
                        <div>
                          <span className="block font-black text-[#0e5e6f] dark:text-slate-200">{mat.title}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            الفرقة: {mat.cohort} • التخصص: {mat.major} • التصنيف: {mat.type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteMaterial(mat.id, mat.isChunked, mat.totalChunks)}
                          className="p-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: ANNOUNCEMENTS */}
          {currentTab === 'announcements' && (
            <div className="space-y-6 fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Form Add Announcement */}
                <div className="admin-card p-6 space-y-4">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 gradient-text-gold">بث إعلان عاجل للطلاب</h3>

                  <form onSubmit={handleAddAnnSubmit} className="space-y-3.5 text-right">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">نص التنبيه</label>
                      <textarea
                        required
                        rows={5}
                        placeholder="اكتب التنبيه الدراسي الهام هنا..."
                        value={annMsg}
                        onChange={e => setAnnMsg(e.target.value)}
                        className="w-full p-3 rounded-xl admin-input font-bold text-xs focus:outline-none resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">نوع المنشور</label>
                        <select
                          value={annType}
                          onChange={e => setAnnType(e.target.value)}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                        >
                          <option value="alert">تنبيه عاجل 🔔</option>
                          <option value="news">خبر / محاضرة 📰</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الفرقة المستهدفة</label>
                        <select
                          value={profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق' ? profile.assignedCohort : annCohort}
                          onChange={e => setAnnCohort(e.target.value)}
                          disabled={profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق'}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none disabled:opacity-70"
                        >
                          <option value="">جميع الفرق 🌍</option>
                          {allowedCohortsForProfile.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">التخصص المستهدف</label>
                        <select
                          value={profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات' ? profile.assignedMajor : annMajor}
                          onChange={e => setAnnMajor(e.target.value)}
                          disabled={profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات'}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none disabled:opacity-70"
                        >
                          <option value="كل التخصصات">كل التخصصات 🎓</option>
                          {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 btn-gold text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer"
                    >
                      بث ونشر الإعلان فوراً 🔔
                    </button>
                    {annStatus && <p className="text-center text-xs font-black text-emerald-600 dark:text-emerald-400">{annStatus}</p>}
                  </form>
                </div>

                {/* Announcements List */}
                <div className="lg:col-span-2 admin-card p-6 overflow-hidden flex flex-col">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 mb-4 gradient-text-gold">قائمة الإعلانات والتبليغات النشطة</h3>

                  <div className="flex-1 overflow-y-auto space-y-3 max-h-[480px] pr-1">
                    {getFilteredAnnouncements().map((ann) => (
                      <div key={ann.id} className="p-4 bg-slate-500/5 dark:bg-slate-950/40 border border-[#0e5e6f]/10 dark:border-slate-800 rounded-2xl space-y-2 text-xs font-bold transition hover:scale-[1.01]">
                        <div className="flex justify-between items-start">
                          <p className="text-[#0e5e6f] dark:text-slate-200 font-extrabold flex-1 leading-relaxed">{ann.msg}</p>
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 rounded-xl transition shrink-0 mr-3 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-800/10 dark:border-slate-800 pt-2">
                          <span>الفرقة: {ann.cohort || 'جميع الفرق'} • التخصص: {ann.major || 'جميع التخصصات'}</span>
                          <span>بواسطة: {ann.addedBy || 'المشرف'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: EXAMS CREATOR */}
          {currentTab === 'exams' && (
            <div className="space-y-6 fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Form Exam Parameters & Builder */}
                <div className="lg:col-span-5 admin-card p-6 space-y-4">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 gradient-text-gold">
                    {editingExamId ? 'تعديل الاختبار الأكاديمي الحالي ✏️' : 'صانع الامتحانات وبابل شيت 🎓'}
                  </h3>

                  <form onSubmit={handleCreateExamSubmit} className="space-y-4 text-right">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">اسم وموضوع الاختبار</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: اختبار برمجة 1 تجريبي"
                        value={examTitle}
                        onChange={e => setExamTitle(e.target.value)}
                        className="w-full px-4 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">المدة (دقائق)</label>
                        <input
                          type="number"
                          required
                          placeholder="15"
                          value={examDuration}
                          onChange={e => setExamDuration(e.target.value)}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الفرقة المستهدفة</label>
                        <select
                          value={profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق' ? profile.assignedCohort : examCohort}
                          onChange={e => setExamCohort(e.target.value)}
                          disabled={profile.role === 'helper' && profile.assignedCohort && profile.assignedCohort !== 'كل الفرق'}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none disabled:opacity-70"
                        >
                          {allowedCohortsForProfile.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">التخصص المستهدف</label>
                        <select
                          value={profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات' ? profile.assignedMajor : examMajor}
                          onChange={e => setExamMajor(e.target.value)}
                          disabled={profile.role === 'helper' && profile.assignedMajor && profile.assignedMajor !== 'كل التخصصات'}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none disabled:opacity-70"
                        >
                          <option value="كل التخصصات">كل التخصصات 🎓</option>
                          {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">تاريخ ووقت البدء (اختياري)</label>
                        <input
                          type="datetime-local"
                          value={examStartDate}
                          onChange={e => setExamStartDate(e.target.value)}
                          className="w-full px-4 py-2.5 admin-input font-bold text-xs focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">تاريخ ووقت الانتهاء (اختياري)</label>
                        <input
                          type="datetime-local"
                          value={examEndDate}
                          onChange={e => setExamEndDate(e.target.value)}
                          className="w-full px-4 py-2.5 admin-input font-bold text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Question Builder Module */}
                    <div className="border-t border-[#0e5e6f]/10 dark:border-slate-800 pt-4 space-y-3">
                      <h4 className="text-xs font-black text-yellow-600 dark:text-yellow-400">إضافة سؤال جديد للاختبار:</h4>

                      <div>
                        <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1">نص السؤال</label>
                        <textarea
                          rows={2}
                          placeholder="اكتب السؤال بالتفصيل هنا..."
                          value={qText}
                          onChange={e => setQText(e.target.value)}
                          className="w-full p-2.5 rounded-xl admin-input font-bold text-xs focus:outline-none resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1">نوع السؤال</label>
                          <select
                            value={qType}
                            onChange={e => setQType(e.target.value)}
                            className="w-full px-2 py-2 rounded-xl admin-input font-bold text-[10px] focus:outline-none"
                          >
                            <option value="mcq">اختيار من متعدد MCQ</option>
                            <option value="tf">صح أو خطأ True/False</option>
                            <option value="essay">سؤال مقالي Essay</option>
                          </select>
                        </div>

                        {qType !== 'essay' && (
                          <div>
                            <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1">الجواب الصحيح</label>
                            {qType === 'mcq' ? (
                              <select
                                value={qCorrect}
                                onChange={e => setQCorrect(e.target.value)}
                                className="w-full px-2 py-2 rounded-xl admin-input font-bold text-[10px] focus:outline-none"
                              >
                                <option value={0}>الخيار الأول (أ)</option>
                                <option value={1}>الخيار الثاني (ب)</option>
                                <option value={2}>الخيار الثالث (ج)</option>
                                <option value={3}>الخيار الرابع (د)</option>
                              </select>
                            ) : (
                              <select
                                value={qCorrect}
                                onChange={e => setQCorrect(e.target.value)}
                                className="w-full px-2 py-2 rounded-xl admin-input font-bold text-[10px] focus:outline-none"
                              >
                                <option value={0}>صح ✅</option>
                                <option value={1}>خطأ ❌</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>

                      {qType === 'mcq' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="خيار أ"
                            value={qOptA}
                            onChange={e => setQOptA(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg admin-input font-bold text-[10px] focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="خيار ب"
                            value={qOptB}
                            onChange={e => setQOptB(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg admin-input font-bold text-[10px] focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="خيار ج"
                            value={qOptC}
                            onChange={e => setQOptC(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg admin-input font-bold text-[10px] focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="خيار د"
                            value={qOptD}
                            onChange={e => setQOptD(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg admin-input font-bold text-[10px] focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddQuestionToExam}
                          className="grow py-2.5 btn-teal text-white font-black rounded-xl text-[10px] transition active:scale-95 shadow-sm cursor-pointer"
                        >
                          {editingQuestionIdx !== null ? '✏️ تحديث تعديل السؤال' : '➕ إضافة السؤال الحالي لقائمة الامتحان'}
                        </button>
                        {editingQuestionIdx !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionIdx(null);
                              setQText('');
                              setQOptA('');
                              setQOptB('');
                              setQOptC('');
                              setQOptD('');
                              setQCorrect(0);
                            }}
                            className="px-3 py-2.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold rounded-xl text-[10px] transition cursor-pointer"
                          >
                            إلغاء التعديل
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 btn-gold text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer"
                    >
                      {editingExamId ? 'تحديث وحفظ تعديلات الاختبار ✏️' : 'حفظ ونشر الامتحان النهائي 🎓'}
                    </button>
                    {editingExamId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExamId(null);
                          setExamTitle('');
                          setExamDuration(15);
                          setExamQuestions([]);
                          setExamStartDate('');
                          setExamEndDate('');
                        }}
                        className="w-full py-2 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-black text-xs rounded-2xl transition cursor-pointer"
                      >
                        إلغاء وضع التعديل (العودة لإنشاء جديد)
                      </button>
                    )}
                    {examStatus && <p className="text-center text-xs font-black text-emerald-600 dark:text-emerald-400">{examStatus}</p>}
                  </form>
                </div>

                {/* Exam List & Live Questions Previews */}
                <div className="lg:col-span-7 space-y-6">

                  {/* Temp Question List */}
                  {examQuestions.length > 0 && (
                    <div className="admin-card p-6 space-y-3">
                      <h3 className="text-xs font-black text-yellow-600 dark:text-yellow-400 border-b border-slate-800/10 dark:border-slate-800 pb-2">
                        الأسئلة الحالية المضافة للامتحان ({examQuestions.length}):
                      </h3>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {examQuestions.map((eq, idx) => (
                          <div key={idx} className={`p-3 border rounded-xl text-[10px] font-bold flex justify-between items-center gap-3 transition ${editingQuestionIdx === idx
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-slate-500/5 dark:bg-slate-950/40 border-[#0e5e6f]/10 dark:border-slate-800'
                            }`}>
                            <div className="grow space-y-1">
                              <div>
                                <span className="text-yellow-600 dark:text-yellow-400 font-black">س {idx + 1}: </span> {eq.q}
                                <span className="text-[9px] text-[#0e5e6f] dark:text-[#bfebd4] mr-2">
                                  ({eq.type === 'mcq' ? 'اختيار متعدد' : eq.type === 'tf' ? 'صح/خطأ' : 'سؤال مقالي'})
                                </span>
                              </div>
                              {eq.type === 'mcq' && (
                                <div className="text-slate-500 dark:text-slate-400 text-[9px] flex gap-2">
                                  <span>أ: {eq.options[0]}</span> • <span>ب: {eq.options[1]}</span> • <span>ج: {eq.options[2]}</span> • <span>د: {eq.options[3]}</span>
                                </div>
                              )}
                              {eq.type === 'mcq' && eq.correct !== undefined && (
                                <div className="text-emerald-500 font-black text-[9px]">الإجابة النموذجية: {['أ', 'ب', 'ج', 'د'][eq.correct]}</div>
                              )}
                              {eq.type === 'tf' && eq.correct !== undefined && (
                                <div className="text-emerald-500 font-black text-[9px]">الإجابة النموذجية: {eq.correct === 0 ? 'صح ✅' : 'خطأ ❌'}</div>
                              )}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditQuestion(idx)}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${editingQuestionIdx === idx
                                  ? 'bg-yellow-500 text-slate-950'
                                  : 'bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-600 dark:text-yellow-400'
                                  }`}
                                title="تعديل هذا السؤال"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(idx)}
                                className="p-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                                title="حذف هذا السؤال"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Published Exams List */}
                  <div className="admin-card p-6 overflow-hidden flex flex-col">
                    <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 mb-4 gradient-text-gold">قائمة الاختبارات النشطة بالمنصة</h3>

                    <div className="overflow-y-auto space-y-3 max-h-[300px] pr-1">
                      {getFilteredExams().map((exam) => (
                        <div key={exam.id} className="p-3.5 bg-slate-500/5 dark:bg-slate-950/40 border border-[#0e5e6f]/10 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs font-bold transition hover:scale-[1.01]">
                          <div>
                            <span className="block font-black text-[#0e5e6f] dark:text-slate-200">{exam.title}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              الفرقة: {exam.cohort} • التخصص: {exam.major || 'كل التخصصات'} • مدة الاختبار: {exam.duration} دقيقة • عدد الأسئلة: {exam.questions?.length || 0}
                            </span>
                            {(exam.startDate || exam.endDate) && (
                              <div className="text-[9px] text-slate-400 font-semibold mt-1">
                                {exam.startDate && <span>يبدأ: {new Date(exam.startDate).toLocaleString('ar-EG')}</span>}
                                {exam.endDate && <span className="mr-2">ينتهي: {new Date(exam.endDate).toLocaleString('ar-EG')}</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingExamId(exam.id);
                                setExamTitle(exam.title || '');
                                setExamDuration(exam.duration || 15);
                                setExamCohort(exam.cohort || COHORTS[0]);
                                setExamMajor(exam.major || 'كل التخصصات');
                                setExamQuestions(exam.questions || []);
                                setExamStartDate(exam.startDate || '');
                                setExamEndDate(exam.endDate || '');
                                showAlert(`تم تحميل اختبار (${exam.title}) للتحرير. يمكنك تعديل الأسئلة والتواريخ والضغط على "تحديث وحفظ تعديلات الاختبار".`, "وضع تحرير الاختبار ✏️");
                              }}
                              className="p-2 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-600 dark:text-yellow-400 rounded-xl transition cursor-pointer"
                              title="تعديل تفاصيل وأسئلة الاختبار"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="p-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 rounded-xl transition cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 8: RESULTS & ESSAY GRADING */}
          {currentTab === 'results' && (
            <div className="space-y-6 fade-in text-right">
              <h2 className="text-xl font-black border-r-4 border-yellow-500 pr-3 gradient-text-gold">نتائج الطلاب ورصد وتصحيح الأسئلة المقالية</h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Right side: Submissions List */}
                <div className={`admin-card p-6 overflow-hidden flex flex-col ${selectedSub ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 mb-4 gradient-text-gold">سجل تسليمات الطلاب والأوراق الإجابة</h3>

                  <div className="overflow-x-auto">
                    <table className="admin-table text-xs text-right">
                      <thead className="text-[#0e5e6f] dark:text-[#bfebd4] font-black">
                        <tr>
                          <th className="p-4">اسم الطالب وبياناته</th>
                          <th className="p-4">اسم الاختبار الأكاديمي</th>
                          <th className="p-4">توقيت التسليم</th>
                          <th className="p-4 text-center">درجة بابل شيت</th>
                          <th className="p-4 text-center">الدرجة الكلية المعتمدة</th>
                          <th className="p-4">حالة التصحيح</th>
                          <th className="p-4 text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredSubmissions().map((sub) => {
                          return (
                            <tr key={sub.id}>
                              <td className="p-4">
                                <span className="block font-black text-slate-800 dark:text-slate-200">{sub.studentName}</span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5">الرقم: {sub.studentId} • {sub.studentCohort} • {sub.studentMajor}</span>
                              </td>
                              <td className="p-4 font-black">{sub.examTitle}</td>
                              <td className="p-4 text-slate-500 dark:text-slate-400 font-semibold" dir="ltr">
                                {new Date(sub.submittedAt).toLocaleString('ar-EG')}
                              </td>
                              <td className="p-4 font-bold text-center">{sub.score} / {sub.totalMCQAndBool || sub.total}</td>
                              <td className="p-4 font-black text-center text-emerald-600 dark:text-emerald-400 text-sm">
                                {sub.finalScore !== undefined ? sub.finalScore : sub.score} / {sub.total}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${sub.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  }`}>
                                  {sub.status === 'pending' ? 'بانتظار تصحيح المقالي ⏳' : 'مصحح ومعتمد 🏆'}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedSub(sub);
                                    setEssayGradeInput(sub.essayGrades || {});
                                    setEssayFeedbackText(sub.essayFeedback || '');
                                    showAlert(`تم فتح ورقة إجابة الطالب (${sub.studentName}) لمراجعة بابل شيت ورصد الأجوبة التحريرية المقالية.`, "مراجعة ورقة الإجابة 📝");
                                  }}
                                  className="px-3 py-1.5 bg-[#0e5e6f]/10 hover:bg-[#0e5e6f]/20 text-[#0e5e6f] dark:text-[#bfebd4] rounded-xl font-black text-[10px] transition cursor-pointer"
                                >
                                  {sub.status === 'pending' ? 'مراجعة وتصحيح 📝' : 'عرض التفاصيل ورصد مجدد ✏️'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {getFilteredSubmissions().length === 0 && (
                          <tr>
                            <td colSpan="7" className="text-center p-8 text-slate-500 font-extrabold">
                              لا توجد أوراق إجابة أو تسليمات مسجلة مطابقة للصلاحيات حالياً.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Left side: Review and Grading Detail Pane */}
                {selectedSub && (
                  <div className="lg:col-span-6 admin-card p-6 space-y-4 fade-in">
                    <div className="flex justify-between items-center border-b border-[#0e5e6f]/15 dark:border-slate-800 pb-3">
                      <h3 className="text-md font-black text-yellow-600 dark:text-yellow-400">
                        مراجعة ورقة إجابة الطالب: {selectedSub.studentName}
                      </h3>
                      <button
                        onClick={() => setSelectedSub(null)}
                        className="p-1.5 bg-slate-500/10 hover:bg-slate-500/20 rounded-xl text-slate-400 font-black cursor-pointer transition"
                      >
                        إغلاق ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-500/5 dark:bg-slate-950/40 p-3 rounded-2xl border border-[#0e5e6f]/10 dark:border-slate-800 font-bold">
                      <div>
                        <span className="text-slate-500">الرقم الأكاديمي:</span> {selectedSub.studentId}
                      </div>
                      <div>
                        <span className="text-slate-500">الفرقة والتخصص:</span> {selectedSub.studentCohort} • {selectedSub.studentMajor}
                      </div>
                      <div>
                        <span className="text-slate-500">اسم الاختبار:</span> {selectedSub.examTitle}
                      </div>
                      <div>
                        <span className="text-slate-500">درجة بابل شيت التلقائية:</span> {selectedSub.score} / {selectedSub.totalMCQAndBool || selectedSub.total}
                      </div>
                    </div>

                    {/* Question details list */}
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {(() => {
                        const examDetails = exams.find(e => e.id === selectedSub.examId);
                        if (!examDetails) {
                          return <p className="text-xs font-black text-rose-500">عفوًا، لم يتم العثور على أصل الامتحان الأكاديمي بالمنصة لمطابقة الأسئلة.</p>;
                        }
                        return examDetails.questions.map((q, idx) => {
                          const isEssay = q.type === 'essay' || !q.options || q.options.length === 0;
                          const studentAnswer = selectedSub.answersSubmitted[idx];

                          return (
                            <div key={idx} className="p-3 bg-slate-500/5 dark:bg-slate-950/40 border border-[#0e5e6f]/10 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                              <div className="flex justify-between items-start gap-3 font-black">
                                <span className="text-yellow-600 dark:text-yellow-400 shrink-0">سؤال {idx + 1} ({isEssay ? 'مقالي' : q.type === 'mcq' ? 'اختيار متعدد' : 'صح/خطأ'}):</span>
                                <p className="text-right flex-1">{q.q}</p>
                              </div>

                              {isEssay ? (
                                <div className="space-y-2 pt-1 border-t border-slate-800/10 dark:border-slate-800">
                                  <span className="block text-[10px] font-black text-slate-500">إجابة الطالب التحريرية المكتوبة:</span>
                                  <div className="p-3 bg-slate-950/40 rounded-xl text-[11px] font-mono leading-relaxed text-slate-200 border border-slate-800 text-right whitespace-pre-wrap">
                                    {studentAnswer || '(لا توجد إجابة أو تم ترك الحقل فارغًا)'}
                                  </div>

                                  <div className="flex items-center gap-3 pt-2">
                                    <label className="text-[10px] font-black text-slate-500">رصد درجة هذا السؤال المقالي:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={essayGradeInput[idx] !== undefined ? essayGradeInput[idx] : ''}
                                      onChange={(e) => setEssayGradeInput(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                                      className="w-20 px-3 py-1.5 rounded-lg admin-input font-bold text-xs focus:outline-none"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800/10 dark:border-slate-800 pt-2 font-bold">
                                  <span>إجابة الطالب بالبابل شيت: <strong className="text-slate-850 dark:text-slate-200">{q.type === 'mcq' ? ['أ', 'ب', 'ج', 'د'][studentAnswer] || 'لم يحل' : studentAnswer === 0 ? 'صح ✅' : studentAnswer === 1 ? 'خطأ ❌' : 'لم يحل'}</strong></span>
                                  <span>الإجابة النموذجية: <strong className="text-emerald-600 dark:text-emerald-400">{q.type === 'mcq' ? ['أ', 'ب', 'ج', 'د'][q.correct] : q.correct === 0 ? 'صح' : 'خطأ'}</strong></span>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Overall feedback form */}
                    <form onSubmit={handleSubmitEssayGrading} className="space-y-3 pt-3 border-t border-slate-850/20">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">ملحوظة المصحح وتقييمه الكلي للطالب</label>
                        <textarea
                          rows={2}
                          placeholder="اكتب تعليق التقييم أو التغذية الراجعة للطالب هنا..."
                          value={essayFeedbackText}
                          onChange={e => setEssayFeedbackText(e.target.value)}
                          className="w-full p-2.5 rounded-xl admin-input font-bold text-xs focus:outline-none resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 btn-gold text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer"
                      >
                        حفظ ورصد درجات الإجابات واعتماد النتيجة فوريًا 🏆
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 9: SCHEDULES */}
          {currentTab === 'schedules' && (
            <div className="space-y-6 fade-in text-right">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Add Schedule Form */}
                <div className="lg:col-span-4 admin-card p-6 space-y-4">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 gradient-text-gold">
                    إضافة وتعميم جدول امتحانات جديد 📅
                  </h3>

                  <form onSubmit={handleAddScheduleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">اسم/عنوان الجدول (مثال: ميدتيرم الفرقة الأولى)</label>
                      <input
                        type="text"
                        required
                        value={schedTitle}
                        onChange={e => setSchedTitle(e.target.value)}
                        className="w-full px-4 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">نوع الامتحانات</label>
                        <select
                          value={schedType}
                          onChange={e => setSchedType(e.target.value)}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                        >
                          <option value="midterm">ميدتيرم (Midterm)</option>
                          <option value="final">الفاينال (Final)</option>
                          <option value="practical">عملي (Practical)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">الفرقة المستهدفة</label>
                        <select
                          value={schedCohort}
                          onChange={e => setSchedCohort(e.target.value)}
                          className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                        >
                          {allowedCohortsForProfile.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">التخصص المستهدف</label>
                      <select
                        value={schedMajor}
                        onChange={e => setSchedMajor(e.target.value)}
                        className="w-full px-3 py-2.5 admin-input font-bold text-xs focus:outline-none"
                      >
                        <option value="كل التخصصات">كل التخصصات 🎓</option>
                        {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">ملاحظات وقواعد للامتحان (اختياري)</label>
                      <textarea
                        rows={2}
                        placeholder="اكتب التنبيهات مثل: الحضور قبل اللجنة بنصف ساعة، يمنع اصطحاب الموبايل..."
                        value={schedNotes}
                        onChange={e => setSchedNotes(e.target.value)}
                        className="w-full p-3 rounded-xl admin-input font-bold text-xs focus:outline-none resize-none"
                      />
                    </div>

                    <div className="border-t border-[#0e5e6f]/10 dark:border-slate-800 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-yellow-600 dark:text-yellow-400">إدراج مواد الجدول:</h4>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            ref={excelInputRef}
                            onChange={handleUploadExcel}
                          />
                          <button
                            type="button"
                            onClick={handleDownloadExcelTemplate}
                            className="px-3 py-1.5 bg-[#0e5e6f]/10 text-[#0e5e6f] dark:text-[#bfebd4] hover:bg-[#0e5e6f]/20 rounded-lg flex items-center gap-1 transition text-[9px]"
                            title="تحميل قالب الإكسيل"
                          >
                            <DownloadCloud size={12} /> تحميل القالب
                          </button>
                          <button
                            type="button"
                            onClick={() => excelInputRef.current?.click()}
                            className="px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg flex items-center gap-1 transition shadow-sm text-[9px]"
                            title="رفع من ملف إكسيل"
                          >
                            <UploadCloud size={12} /> استيراد اكسيل
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1">تاريخ ووقت اللجنة</label>
                          <input
                            type="text"
                            placeholder="مثال: الثلاثاء 25/5 12:00PM"
                            value={schedExamDate}
                            onChange={e => setSchedExamDate(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl admin-input font-bold text-[10px] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 mb-1">اسم المقرر/المادة</label>
                          <input
                            type="text"
                            placeholder="مثال: هندسة برمجيات"
                            value={schedExamSubject}
                            onChange={e => setSchedExamSubject(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl admin-input font-bold text-[10px] focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!schedExamDate || !schedExamSubject) return;
                          setSchedExams([...schedExams, { date: schedExamDate, subject: schedExamSubject }]);
                          setSchedExamDate('');
                          setSchedExamSubject('');
                        }}
                        className="w-full py-2 bg-[#0e5e6f]/10 hover:bg-[#0e5e6f]/20 text-[#0e5e6f] dark:text-[#bfebd4] font-black rounded-xl text-[10px] transition cursor-pointer"
                      >
                        ➕ إضافة المادة للجدول أدناه
                      </button>

                      {/* Preview of added exams */}
                      {schedExams.length > 0 && (
                        <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1">
                          {schedExams.map((ex, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-lg text-[10px] font-bold">
                              <span className="text-[#0e5e6f] dark:text-[#bfebd4]">{ex.date}</span>
                              <span className="text-slate-700 dark:text-slate-300">{ex.subject}</span>
                              <button type="button" onClick={() => setSchedExams(schedExams.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-600 cursor-pointer">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 btn-gold text-slate-950 font-black rounded-2xl text-xs shadow-md transition cursor-pointer"
                    >
                      حفظ واعتماد الجدول نهائياً 🚀
                    </button>
                    {schedStatus && <p className="text-center text-xs font-black text-emerald-600 dark:text-emerald-400">{schedStatus}</p>}
                  </form>
                </div>

                {/* Schedules List */}
                <div className="lg:col-span-8 admin-card p-6 overflow-hidden flex flex-col">
                  <h3 className="text-md font-black border-r-4 border-yellow-500 pr-2 mb-4 gradient-text-gold">الجداول الدراسية المضافة والموثقة</h3>

                  <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] pr-1">
                    {schedules.map((sched) => (
                      <div key={sched.id} className="p-4 bg-slate-500/5 dark:bg-slate-950/40 border border-[#0e5e6f]/10 dark:border-slate-800 rounded-2xl transition hover:scale-[1.01] space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="block font-black text-[#0e5e6f] dark:text-slate-200 text-sm mb-1">{sched.title}</span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex flex-wrap gap-2">
                              <span className="bg-[#0e5e6f]/10 text-[#0e5e6f] dark:text-[#bfebd4] px-2 py-0.5 rounded-md">نوع: {sched.type === 'midterm' ? 'ميدتيرم' : sched.type === 'final' ? 'فاينال' : 'عملي'}</span>
                              <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">الفرقة: {sched.cohort}</span>
                              <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">تخصص: {sched.major}</span>
                              <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">بواسطة: {sched.addedBy}</span>
                            </span>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleScheduleVisibility(sched.id, sched.visible)}
                              className={`p-2 rounded-xl transition cursor-pointer text-white font-bold flex items-center gap-1.5 text-[10px] ${sched.visible
                                ? 'bg-amber-500 hover:bg-amber-600 shadow-md'
                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-md'
                                }`}
                              title={sched.visible ? "إخفاء الجدول مؤقتاً عن الطلاب" : "إظهار الجدول للطلاب"}
                            >
                              {sched.visible ? <EyeOff size={14} /> : <Eye size={14} />}
                              {sched.visible ? 'إخفاء مؤقت' : 'تفعيل وإظهار'}
                            </button>

                            <button
                              onClick={() => handleDeleteSchedule(sched.id)}
                              className="p-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 rounded-xl transition cursor-pointer"
                              title="حذف الجدول نهائياً"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {sched.notes && (
                          <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                            <strong>ملاحظات:</strong> {sched.notes}
                          </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <table className="w-full text-[10px] font-bold text-right">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                              <tr>
                                <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">تاريخ ووقت اللجنة</th>
                                <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">المقرر / المادة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sched.exams && sched.exams.map((ex, i) => (
                                <tr key={i} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                                  <td className="p-2.5 text-[#0e5e6f] dark:text-[#bfebd4]">{ex.date}</td>
                                  <td className="p-2.5 text-slate-700 dark:text-slate-300">{ex.subject}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                      </div>
                    ))}
                    {schedules.length === 0 && (
                      <div className="text-center p-8 text-slate-500 font-extrabold text-sm border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
                        لا توجد جداول امتحانات معلنة حالياً.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 10: LOGS (ADMIN ONLY) */}
          {currentTab === 'logs' && profile.role === 'admin' && (
            <div className="space-y-6 fade-in text-right">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black border-r-4 border-yellow-500 pr-3 gradient-text-gold">سجل نشاطات وعمليات الإدارة</h2>
                <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black flex items-center gap-2">
                  <Check size={14} /> يتم تنظيف السجلات تلقائياً كل 7 أيام
                </div>
              </div>

              <div className="admin-card p-6 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="admin-table text-xs text-right">
                    <thead className="text-[#0e5e6f] dark:text-[#bfebd4] font-black">
                      <tr>
                        <th className="p-4 w-40">توقيت العملية</th>
                        <th className="p-4 w-48">اسم المسؤول</th>
                        <th className="p-4 w-48">نوع العملية</th>
                        <th className="p-4">التفاصيل والتغييرات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="p-4 text-[10px] font-bold text-slate-500 dark:text-slate-400" dir="ltr">
                            {log.timestamp ? new Date(log.timestamp.toMillis()).toLocaleString('ar-EG') : 'الآن'}
                          </td>
                          <td className="p-4 font-black text-slate-700 dark:text-slate-300">{log.adminName}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-[#0e5e6f]/10 text-[#0e5e6f] dark:text-[#bfebd4] rounded-full text-[10px] font-black border border-[#0e5e6f]/20">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center p-8 text-slate-500 font-extrabold text-sm">
                            سجل العمليات فارغ حالياً.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Footer Branding */}
      <footer className="py-4 text-center sidebar-panel border-t border-[#0e5e6f]/15 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 tracking-wider select-none">
        Developed & Managed by <span className="text-rose-600 dark:text-yellow-400 font-extrabold">ENG / EL LOL</span> – Taiba Institute Systems Dashboard © 2026
      </footer>

      {/* Premium Custom Modal Dialog */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="admin-card max-w-sm w-full p-6 text-right border border-yellow-500/30 shadow-2xl space-y-4 scale-in">
            <div className="flex items-center gap-3 border-b border-[#0e5e6f]/15 dark:border-slate-800/80 pb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-md font-black text-[#072327] dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-yellow-400 dark:to-amber-200">
                {modalConfig.title}
              </h3>
            </div>

            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
              {modalConfig.message}
            </p>

            <div className="flex gap-2 justify-end pt-2">
              {modalConfig.type === 'confirm' && (
                <button
                  onClick={modalConfig.onCancel}
                  className="px-4 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-400 font-black text-xs rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              )}
              <button
                onClick={modalConfig.onConfirm}
                className="px-4 py-2 btn-gold text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
              >
                {modalConfig.type === 'confirm' ? 'تأكيد ومتابعة' : 'موافق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Ban Configuration Modal Dialog */}
      {banModalConfig.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="admin-card max-w-md w-full p-6 md:p-8 text-right border border-red-500/30 shadow-2xl space-y-5 scale-in">
            <div className="flex items-center gap-3 border-b border-[#0e5e6f]/15 dark:border-slate-800/80 pb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-650 flex items-center justify-center text-white shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m0-8v6m0 5h.01M5.938 18h12.124c1.348 0 2.19-1.458 1.516-2.625L13.516 6.375c-.675-1.167-2.357-1.167-3.032 0L4.422 15.375c-.674 1.167.168 2.625 1.516 2.625z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-[#072327] dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-red-400 dark:to-rose-300">
                  إجراء تعليق الحساب الأكاديمي
                </h3>
                <p className="text-[10px] font-bold text-slate-500">للطالب: {banModalConfig.studentName}</p>
              </div>
            </div>

            {/* Form inputs */}
            <div className="space-y-4">

              {/* Reason Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-650 dark:text-slate-400">
                  سبب الحظر المسجل (سيظهر للطالب): <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={banModalConfig.reason}
                  onChange={(e) => setBanModalConfig(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="مثال: كتابة مشاركات مسيئة بالدردشة الجامعية ومخالفة ضوابط الذوق العام."
                  className="w-full p-3 rounded-xl border border-slate-300/80 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs font-bold leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              {/* Ban Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-650 dark:text-slate-400">
                  نوع الإجراء الإداري:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBanModalConfig(prev => ({ ...prev, banType: 'temp' }))}
                    className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer border flex items-center justify-center gap-1.5 ${banModalConfig.banType === 'temp'
                      ? 'bg-amber-600/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold'
                      : 'bg-slate-500/5 border-slate-300/30 text-slate-550 dark:text-slate-450 hover:bg-slate-500/10'
                      }`}
                  >
                    ⏳ إيقاف وحظر مؤقت
                  </button>
                  <button
                    type="button"
                    onClick={() => setBanModalConfig(prev => ({ ...prev, banType: 'perm' }))}
                    className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer border flex items-center justify-center gap-1.5 ${banModalConfig.banType === 'perm'
                      ? 'bg-red-600/10 border-red-500/30 text-red-650 dark:text-red-400 font-extrabold'
                      : 'bg-slate-500/5 border-slate-300/30 text-slate-550 dark:text-slate-450 hover:bg-slate-500/10'
                      }`}
                  >
                    ⛔ حظر أبدي ونهائي
                  </button>
                </div>
              </div>

              {/* Temporary Ban duration in hours */}
              {banModalConfig.banType === 'temp' && (
                <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-2xl animate-fade-in">
                  <label className="block text-[10px] font-black text-amber-650 dark:text-amber-400">
                    مدة الحظر المؤقت (بالساعات):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={banModalConfig.durationHours}
                      onChange={(e) => setBanModalConfig(prev => ({ ...prev, durationHours: e.target.value }))}
                      className="w-24 px-3 py-1.5 rounded-lg border border-amber-500/25 bg-white/40 dark:bg-slate-950/40 text-xs font-black focus:outline-none"
                    />

                    {/* Pre-defined hours quick selectors */}
                    <div className="flex-1 flex gap-1 justify-end">
                      {['6', '24', '72', '168'].map(hrs => (
                        <button
                          key={hrs}
                          type="button"
                          onClick={() => setBanModalConfig(prev => ({ ...prev, durationHours: hrs }))}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${banModalConfig.durationHours === hrs
                            ? 'bg-amber-650 border-amber-600 text-slate-900 dark:text-slate-100 font-extrabold'
                            : 'bg-white/40 dark:bg-slate-900/30 border-slate-300/20 text-slate-650 dark:text-slate-400 hover:bg-slate-500/10'
                            }`}
                        >
                          {hrs === '6' ? '6 س' : hrs === '24' ? 'يوم' : hrs === '72' ? '3 أيام' : 'أسبوع'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 justify-end pt-3 border-t border-[#0e5e6f]/15 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setBanModalConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-400 font-black text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء ✖
              </button>
              <button
                type="button"
                onClick={handleConfirmBanSubmit}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-md"
              >
                تأكيد وتنفيذ الحظر فوريًا 🚫
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
