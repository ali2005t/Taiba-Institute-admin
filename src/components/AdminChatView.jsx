import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, updateDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { Users, CornerUpLeft, Trash2, X, Smile, Flag } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';

export default function UnifiedChatView({ profile, groupMessages, privateMessages, friendships, studentDirectory, onViewProfile }) {
  const [activeTab, setActiveTab] = useState('group'); // 'group' or 'private'
  const [selectedFriend, setSelectedFriend] = useState(null); // active private chat friend profile
  const [newMessage, setNewMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState(null); // Quote/Reply target message
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Reporting State
  const [reportingMsg, setReportingMsg] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Mentions State
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionList, setMentionList] = useState([]);
  const [mentionCursorIndex, setMentionCursorIndex] = useState(0);

  // Mobile Touch Gestures State
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [swipingMsgId, setSwipingMsgId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const longPressRef = useRef(null);

  const EMOJI_CATEGORIES = [
    {
      name: 'المشاعِر 😊',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '🤫', '🫡', '🫣', '🤭', '🫢', '🫠', '🤔', '😴', '😷', '👿', '😈']
    },
    {
      name: 'التفاعُلات 👍',
      emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '✋', '🤚', '👋', '🤙', '💪', '🦾', '🙏', '🤝', '👏', '🙌', '👐', '🤲', '👂', '👃', '🧠', '👀']
    },
    {
      name: 'الدِراسة 🎓',
      emojis: ['🎓', '📚', '📖', '🏫', '✏️', '📝', '🗒️', '📐', '📏', '📊', '📈', '📉', '💼', '🎒', '🧠', '💡', '🔔', '💻', '🖥️', '⌨️', '🔋', '🔌', '📅', '📆', '🗓️', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅']
    },
    {
      name: 'مُنوّعات ❤️',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '🔥', '✨', '🌟', '⭐', '🌈', '⚡', '💥', '🎉', '🎊', '🎈', '🎀', '🎁', '🎂', '☕', '🥛', '🥤', '🍕', '🍔', '🍟', '🍎', '🍓']
    }
  ];
  const [selectedEmojiCategoryIdx, setSelectedEmojiCategoryIdx] = useState(0);
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [groupMessages, privateMessages, selectedFriend, activeTab]);

  // Unique channel key for private chats (sorting IDs in JS)
  const getPrivateChatKey = (uid1, uid2) => {
    return [uid1, uid2].sort().join('_');
  };

  const cohortSafe = (profile.cohort || 'الفرقة الأولى').replace(/\s+/g, '_');
  const majorSafe = (profile.major || 'عام').replace(/\s+/g, '_');
  const channelId = activeTab === 'group'
    ? `group_${cohortSafe}_${majorSafe}`
    : (selectedFriend ? `private_${getPrivateChatKey(profile.uid, selectedFriend.uid)}` : null);

  // typing status listener
  useEffect(() => {
    if (!channelId) return;
    const typingDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'typing', channelId);

    const unsub = onSnapshot(typingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const activeTypers = [];

        Object.keys(data).forEach(uid => {
          if (uid !== profile.uid && data[uid]) {
            // Check if status is fresh (less than 4 seconds) to avoid stale typing displays
            if (Date.now() - data[uid].timestamp < 4000) {
              activeTypers.push(data[uid].name);
            }
          }
        });

        setTypingUsers(activeTypers);
      } else {
        setTypingUsers([]);
      }
    });

    return () => unsub();
  }, [channelId]);

  // Mark private messages as read
  useEffect(() => {
    if (activeTab !== 'private' || !selectedFriend || !privateMessages.length) return;

    const chatKey = getPrivateChatKey(profile.uid, selectedFriend.uid);
    const unreadMsgs = privateMessages.filter(m => m.chatKey === chatKey && m.senderId === selectedFriend.uid && !m.read);

    if (unreadMsgs.length === 0) return;

    unreadMsgs.forEach(async (msg) => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'private_chats', msg.id);
        await updateDoc(docRef, { read: true });
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    });
  }, [selectedFriend, activeTab, privateMessages]);

  const updateTypingStatus = async (isTyping) => {
    if (!channelId) return;
    const typingDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'typing', channelId);
    try {
      await setDoc(typingDocRef, {
        [profile.uid]: isTyping ? { name: profile.name, timestamp: Date.now() } : null
      }, { merge: true });
    } catch (e) {
      console.error("Typing update error:", e);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);

    // Trigger typing online status
    updateTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { updateTypingStatus(false); }, 2000);

    // Mentions logic
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbolIndex !== -1) {
      const isStartOfWord = lastAtSymbolIndex === 0 || val[lastAtSymbolIndex - 1] === ' ';
      if (isStartOfWord) {
        const query = textBeforeCursor.slice(lastAtSymbolIndex + 1);
        if (!query.includes(' ')) {
          setMentionQuery(query);
          const participantsMap = new Map();

        // 1. Add admins for this cohort
        studentDirectory.forEach(s => {
          if (s.role === 'admin' || s.role === 'helper') {
            const sCohort = s.assignedCohort || s.cohort;
            const isGlobalAdmin = sCohort === 'كل الفرق' || sCohort === 'الجميع' || !sCohort;
            const sMajor = s.assignedMajor || s.major;
            const isGlobalMajor = sMajor === 'كل التخصصات' || sMajor === 'الجميع' || !sMajor;

            const cohortMatches = sCohort === profile.cohort || isGlobalAdmin;
            const majorMatches = sMajor === profile.major || isGlobalMajor;

            if (s.uid !== profile.uid && cohortMatches && majorMatches) {
              const displayName = s.adminNickname || 'الدعم الفني';
              participantsMap.set(s.uid, { uid: s.uid, name: displayName, role: 'admin' });
            }
          }
        });

        // 2. Add recent participants from chat
        if (activeTab === 'group') {
          groupMessages.forEach(msg => {
            // Don't add admins here so they don't appear twice
            if ((msg.role !== 'admin' && msg.role !== 'helper') && msg.senderId !== profile.uid && !participantsMap.has(msg.senderId)) {
              participantsMap.set(msg.senderId, { uid: msg.senderId, name: msg.senderName, role: msg.role || 'student' });
            }
          });
        } else if (activeTab === 'private' && selectedFriend) {
          participantsMap.set(selectedFriend.uid, { uid: selectedFriend.uid, name: selectedFriend.name, role: selectedFriend.role || 'student' });
        }

        const allCandidates = Array.from(participantsMap.values());
        const availableMentions = allCandidates.filter(s =>
          s.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);

        setMentionList(availableMentions);
        setMentionCursorIndex(0);
        return;
      }
    }
    }
    setMentionQuery(null);
  };

const insertMention = (student) => {
  const val = newMessage;
  const cursorPosition = inputRef.current?.selectionStart || val.length;
  const textBeforeCursor = val.slice(0, cursorPosition);
  const lastAtSymbolIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtSymbolIndex !== -1) {
    const textBeforeMention = val.slice(0, lastAtSymbolIndex);
    const textAfterCursor = val.slice(cursorPosition);
    const newText = textBeforeMention + '@' + student.name.replace(/\s+/g, '_') + ' ' + textAfterCursor;
    setNewMessage(newText);
    setMentionQuery(null);
    inputRef.current?.focus();
  }
};

const handleReportSubmit = async (e) => {
  e.preventDefault();
  if (!reportReason.trim() || !reportingMsg) return;
  setReportSubmitting(true);
  try {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chat_reports'), {
      messageId: reportingMsg.id,
      messageText: reportingMsg.text,
      senderId: reportingMsg.senderId,
      senderName: reportingMsg.senderName,
      reporterId: profile.uid,
      reporterName: profile.name,
      cohort: profile.cohort,
      reason: reportReason,
      timestamp: serverTimestamp(),
      status: 'pending'
    });
    setReportingMsg(null);
    setReportReason('');
    alert("تم إرسال البلاغ للإدارة بنجاح. شكراً لتعاونك.");
  } catch (err) {
    console.error("Report error:", err);
    alert("حدث خطأ أثناء الإرسال، يرجى المحاولة لاحقاً.");
  } finally {
    setReportSubmitting(false);
  }
};

// Retrieve friends (accepted friendships)
const acceptedFriends = friendships
  .filter(f => f.status === 'accepted' && (f.senderUid === profile.uid || f.receiverUid === profile.uid))
  .map(f => {
    const friendUid = f.senderUid === profile.uid ? f.receiverUid : f.senderUid;
    return studentDirectory.find(s => s.uid === friendUid) || { uid: friendUid, name: 'طالب في معهد طيبة', studentId: 'TBA' };
  });

const getFriendAvatar = (student) => {
  if (student.avatarUrl) return student.avatarUrl;
  return student.gender === 'أنثى'
    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tiera'
    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Christian';
};

const getUnreadCountForFriend = (friendUid) => {
  const chatKey = getPrivateChatKey(profile.uid, friendUid);
  return privateMessages.filter(m => m.chatKey === chatKey && m.senderId === friendUid && !m.read).length;
};

const getFormattedDateHeader = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'اليوم';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'أمس';
  } else {
    return date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
};

const getFormattedTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const handleSendMessage = async (e) => {
  e.preventDefault();
  if (!newMessage.trim()) return;

  // College Profanity Filter & Auto-Moderation (رقابة الكلية التلقائية للذوق العام)
  const badWords = [
    'غبي', 'حمار', 'كلب', 'حيوان', 'كافر', 'معرص', 'خول', 'متخلف', 'وسخ', 'وسخه',
    'زبالة', 'زباله', 'تافه', 'قذر', 'شرموط', 'شرموطه', 'قحبة', 'قحبه', 'كسك',
    'بضان', 'احا', 'أحا', 'عرص', 'شاذ', 'منيوك', 'نيك', 'ينيك', 'طيز', 'طيزك',
    'لبوة', 'لبوه', 'نجس', 'ابن الكلب', 'ابن كلب'
  ];
  let censoredText = newMessage;
  badWords.forEach(word => {
    const regex = new RegExp(`(ال|يا|ب|ف|ك|و)?${word}`, 'gi');
    censoredText = censoredText.replace(regex, '***');
  });

  // Clear typing indicator immediately
  updateTypingStatus(false);
  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

  try {
    // extract mentions looking for @username
    const mentions = [];
    studentDirectory.forEach(s => {
      const displayName = (s.role === 'admin' || s.role === 'helper') ? (s.adminNickname || 'الدعم الفني') : s.name;
      const mentionHandle = '@' + displayName.replace(/\s+/g, '_');
      if (newMessage.includes(mentionHandle)) {
        mentions.push(s.uid);
      }
    });

    if (activeTab === 'group') {
      const chatRef = collection(db, 'artifacts', appId, 'public', 'data', `chat_${cohortSafe}_${majorSafe}`);
      await addDoc(chatRef, {
        text: censoredText,
        mentions: mentions,
        senderId: profile.uid,
        senderName: profile.name,
        senderNickname: profile.role === 'admin' ? (profile.adminNickname || 'الدعم الفني') : null,
        deleted: false,
        replyTo: replyTarget ? { 
          text: replyTarget.text, 
          senderName: replyTarget.role === 'admin' 
            ? (studentDirectory.find(s => s.uid === replyTarget.senderId)?.adminNickname || 'الدعم الفني') 
            : replyTarget.senderName 
        } : null,
        timestamp: serverTimestamp(),
        reactions: {}
      });
    } else {
      if (!selectedFriend) return;
      const chatKey = getPrivateChatKey(profile.uid, selectedFriend.uid);
      const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'private_chats');
      await addDoc(chatRef, {
        chatKey,
        text: censoredText,
        mentions: mentions,
        senderId: profile.uid,
        senderName: profile.name,
        senderNickname: profile.role === 'admin' ? (profile.adminNickname || 'الدعم الفني') : null,
        deleted: false,
        replyTo: replyTarget ? { 
          text: replyTarget.text, 
          senderName: replyTarget.role === 'admin' 
            ? (studentDirectory.find(s => s.uid === replyTarget.senderId)?.adminNickname || 'الدعم الفني') 
            : replyTarget.senderName 
        } : null,
        timestamp: serverTimestamp(),
        reactions: {},
        read: false
      });
    }
    setNewMessage('');
    setReplyTarget(null);
    setShowEmojiPicker(false);
  } catch (err) {
    console.error("Error sending message", err);
  }
};

const deleteMessage = async (msgId, isPrivate) => {
  try {
    const collectionName = isPrivate ? 'private_chats' : `chat_${cohortSafe}_${majorSafe}`;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, msgId);
    await updateDoc(docRef, {
      deleted: true,
      text: 'تمت إزالة هذه الرسالة بواسطة ' + profile.name
    });
  } catch (error) {
    console.error(error);
  }
};

const handleToggleReaction = async (msg, emoji) => {
  if (msg.deleted) return;
  try {
    const collectionName = activeTab === 'private' ? 'private_chats' : `chat_${cohortSafe}_${majorSafe}`;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, msg.id);

    const currentReactions = msg.reactions || {};
    let updatedReactions = {};

    // Remove user from all existing reactions first (Ensures only 1 reaction per user)
    Object.keys(currentReactions).forEach(key => {
      updatedReactions[key] = currentReactions[key].filter(uid => uid !== profile.uid);
    });

    // Check if the user was already reacting with THIS specific emoji
    const hadThisEmoji = (currentReactions[emoji] || []).includes(profile.uid);

    // If they didn't have this emoji, add them to it (if they did, it remains removed = toggle off)
    if (!hadThisEmoji) {
      updatedReactions[emoji] = [...(updatedReactions[emoji] || []), profile.uid];
    }

    await updateDoc(docRef, {
      reactions: updatedReactions
    });
    setActiveReactionMsgId(null); // Close mobile reaction menu if open
  } catch (err) {
    console.error("Failed toggle reaction:", err);
  }
};

// Mobile Gesture Handlers
const handleTouchStart = (e, msg) => {
  if (msg.deleted) return;
  const touch = e.touches[0];
  longPressRef.current = {
    startX: touch.clientX,
    startY: touch.clientY,
    msgId: msg.id,
    timer: setTimeout(() => {
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
      setActiveReactionMsgId(msg.id);
    }, 500)
  };
};

const handleTouchMove = (e, msg) => {
  if (!longPressRef.current || msg.deleted) return;
  const touch = e.touches[0];
  const diffX = touch.clientX - longPressRef.current.startX;
  const diffY = touch.clientY - longPressRef.current.startY;

  if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
    clearTimeout(longPressRef.current.timer);

    // Swipe left to reply (negative diffX)
    if (diffX < -15 && Math.abs(diffY) < 30) {
      setSwipingMsgId(msg.id);
      setSwipeOffset(Math.max(-80, diffX));
    }
  }
};

const handleTouchEnd = (e, msg) => {
  if (longPressRef.current) {
    clearTimeout(longPressRef.current.timer);
  }
  if (swipingMsgId === msg.id) {
    if (swipeOffset <= -50) {
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
      setReplyTarget(msg);
    }
    setSwipingMsgId(null);
    setSwipeOffset(0);
  }
  longPressRef.current = null;
};

// Filter messages for current private chat
const currentPrivateMessages = selectedFriend
  ? privateMessages.filter(m => m.chatKey === getPrivateChatKey(profile.uid, selectedFriend.uid))
  : [];

const activeMessages = activeTab === 'group' ? groupMessages : currentPrivateMessages;

return (
  <div className="flex flex-col md:flex-row h-[calc(100vh-170px)] glass-premium rounded-3xl overflow-hidden fade-in border-2 border-[#82af96] dark:border-[#3c6550]">

    {/* Sidebar for choosing Group vs Private Friend */}
    <div className="w-full md:w-80 border-l-2 border-[#82af96] dark:border-[#3c6550] bg-white/40 dark:bg-[#09171a]/40 flex flex-col shrink-0 text-right overflow-hidden">

      {/* Toggle General vs Private (Disabled for Admin) */}
      <div className="p-4 border-b-2 border-[#82af96] dark:border-[#3c6550] shrink-0 text-center bg-[#bfebd4]/10">
        <span className="text-xs font-black text-[#0e5e6f] dark:text-[#bfebd4]">🛡️ الشات العام للدفعة</span>
      </div>

      {/* Directory List based on Selection */}
      <div className={`flex-none md:flex-1 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto p-2 md:p-3 flex flex-row md:flex-col gap-2 no-scrollbar ${activeTab === 'group' ? 'flex-col overflow-y-auto max-h-32 md:max-h-full' : ''}`}>
        {activeTab === 'group' ? (
          <div className="p-3 md:p-4 bg-[#bfebd4]/20 border border-[#82af96] rounded-xl shrink-0">
            <h4 className="font-black text-xs md:text-sm text-[#0e5e6f] dark:text-[#bfebd4] mb-1">📢 شات دفعة {profile.cohort}</h4>
            <p className="text-[10px] md:text-xs text-slate-800 dark:text-slate-300 leading-relaxed font-semibold">
              شات عام للدفعة. يتم حذف جميع الرسائل نهائياً بعد مرور 3 أيام للحفاظ على الخصوصية والمساحة.
            </p>
          </div>
        ) : (
          <>
            <h4 className="hidden md:block font-black text-xs text-[#0e5e6f] dark:text-[#bfebd4] mb-1 px-1">الزملاء النشطون ({acceptedFriends.length})</h4>
            {acceptedFriends.length === 0 ? (
              <p className="text-xs text-slate-500 font-bold p-3 text-center w-full">لا يوجد أصدقاء. أضف زملائك للدردشة!</p>
            ) : (
              acceptedFriends.map(friend => {
                const friendUnreadCount = getUnreadCountForFriend(friend.uid);
                return (
                  <button
                    key={friend.uid}
                    onClick={() => setSelectedFriend(friend)}
                    className={`min-w-[75px] max-w-[85px] md:min-w-0 md:max-w-none md:w-full p-2 md:p-3.5 rounded-xl flex flex-col md:flex-row items-center gap-1.5 md:gap-3 transition text-center md:text-right shrink-0
                        ${selectedFriend?.uid === friend.uid
                        ? 'bg-[#bfebd4]/40 border-2 border-[#0e5e6f]'
                        : 'bg-white dark:bg-[#0d2328] border border-slate-300 dark:border-slate-800 hover:bg-[#bfebd4]/20'}
                      `}
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 md:w-9 md:h-9 rounded-full bg-slate-200 border border-slate-300">
                        <img src={getFriendAvatar(friend)} alt="avatar" className="w-full h-full rounded-full object-cover" />
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 md:w-2.5 md:h-2.5 rounded-full border-2 border-white dark:border-[#0d2328] ${friend.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    </div>
                    <div className="flex-1 min-w-0 w-full overflow-hidden">
                      <div className="flex items-center justify-center md:justify-start gap-1">
                        <h5 className="font-black text-[10px] md:text-xs text-slate-900 dark:text-slate-100 truncate block w-full">{friend.name}</h5>
                      </div>
                      <p className="hidden md:block text-[10px] text-slate-500 truncate font-bold mt-0.5">ID: {friend.studentId}</p>
                    </div>
                    {friendUnreadCount > 0 && (
                      <span className="absolute top-1 right-1 md:static bg-rose-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shrink-0 shadow-md">
                        {friendUnreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </>
        )}
      </div>
    </div>

    {/* Main Messaging Panel */}
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/10 dark:bg-slate-950/10">

      {/* Chat Title bar */}
      <div className="p-4 border-b-2 border-[#82af96] dark:border-[#3c6550] bg-white/50 dark:bg-[#09171a]/50 flex items-center justify-between text-right z-10 shadow-sm">
        <div className="flex items-center gap-3">
          {activeTab === 'private' && selectedFriend && (
            <div className="relative shrink-0 ml-1">
              <div
                className="w-11 h-11 rounded-full bg-slate-200 shrink-0 cursor-pointer p-0.5 border-2 border-[#82af96] shadow-sm hover:scale-105 transition"
                onClick={() => onViewProfile && onViewProfile(selectedFriend)}
              >
                <img
                  src={getFriendAvatar(selectedFriend)}
                  alt="Friend Avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#09171a] ${selectedFriend.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5">
              <h3
                onClick={() => activeTab === 'private' && selectedFriend && onViewProfile && onViewProfile(selectedFriend)}
                className={`font-black text-base text-[#0e5e6f] dark:text-[#bfebd4] flex items-center gap-1.5 ${activeTab === 'private' && selectedFriend ? 'cursor-pointer hover:underline' : ''}`}
              >
                {activeTab === 'group' ? `غرفة نقاش الدفعة: ${profile.cohort}` : (selectedFriend ? selectedFriend.name : 'اختر زميلاً لبدء محادثة مشفرة')}
                {activeTab === 'private' && selectedFriend && <VerifiedBadge />}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'group'
                ? (typingUsers.length > 0
                  ? `✍️ ${typingUsers.join(' و ')} يكتبون الآن...`
                  : 'شات جماعي للدفعة. (يتم حذف جميع الرسائل تلقائياً كل 3 أيام)')
                : (selectedFriend
                  ? (typingUsers.includes(selectedFriend.name)
                    ? '✍️ يكتب الآن...'
                    : `معرّف الطالب: ${selectedFriend.studentId} • ${selectedFriend.status === 'online' ? 'متصل الآن 🟢' : 'غير متصل ⚪'}`)
                  : 'اضغط على الصديق لفتح شات خاص مغلق')
              }
            </p>
          </div>
        </div>
      </div>

      {/* Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'private' && !selectedFriend ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center font-bold p-6">
            <Users size={48} className="text-[#0e5e6f] mb-2" />
            <p className="text-sm">الرجاء اختيار زميل من قائمة الأصدقاء على اليمين لبدء المحادثة الفورية الخاصة.</p>
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 font-bold text-xs">
            لا توجد رسائل سابقة. بادر بفتح حوار راقٍ ومفيد!
          </div>
        ) : (
          activeMessages.map((msg, index) => {
            const isMe = msg.senderId === profile.uid;
            const senderObj = studentDirectory.find(s => s.uid === msg.senderId) || {};
            const reactions = msg.reactions || {};

            // Check if we need to show date header
            const showDateHeader = index === 0 || (() => {
              const prevMsg = activeMessages[index - 1];
              if (!prevMsg || !prevMsg.timestamp || !msg.timestamp) return false;
              const prevDate = prevMsg.timestamp.toDate ? prevMsg.timestamp.toDate() : new Date(prevMsg.timestamp);
              const currDate = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
              return prevDate.toDateString() !== currDate.toDateString();
            })();

            return (
              <React.Fragment key={msg.id}>
                {showDateHeader && msg.timestamp && (
                  <div className="flex justify-center my-4 fade-in">
                    <span className="px-4 py-1 rounded-full text-[10px] font-black bg-[#bfebd4]/40 text-[#0e5e6f] dark:bg-[#112d26] dark:text-[#bfebd4] shadow-sm border border-[#82af96]/30">
                      {getFormattedDateHeader(msg.timestamp)}
                    </span>
                  </div>
                )}

                <div className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start fade-in`}>

                  {/* Clickable Avatar URL */}
                  {!msg.deleted && (
                    <div
                      className="w-8 h-8 rounded-full bg-slate-200 shrink-0 cursor-pointer p-0.5 border hover:scale-105 transition"
                      onClick={() => onViewProfile && onViewProfile({ ...senderObj, name: msg.senderName, uid: msg.senderId })}
                    >
                      <img
                        src={getFriendAvatar({ ...senderObj, name: msg.senderName, gender: senderObj.gender })}
                        alt="Sender Avatar"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  )}

                  <div
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%] relative transition-transform duration-75`}
                    style={swipingMsgId === msg.id ? { transform: `translateX(${swipeOffset}px)` } : {}}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={(e) => handleTouchMove(e, msg)}
                    onTouchEnd={(e) => handleTouchEnd(e, msg)}
                  >

                    {/* Sender Name */}
                    {!isMe && !msg.deleted && (
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-400 mr-1 mb-1 flex items-center gap-1">
                        {(msg.role === 'admin' || msg.role === 'helper') && (
                          <span className="bg-[#0e5e6f] text-white px-1.5 py-0.5 rounded text-[8px] mr-1">إدارة المنصة 🛡️</span>
                        )}
                        {(msg.role === 'admin' || msg.role === 'helper') ? (senderObj.adminNickname || 'الدعم الفني') : msg.senderName}
                        <VerifiedBadge />
                      </span>
                    )}

                    {/* Quoted Message Preview */}
                    {msg.replyTo && !msg.deleted && (
                      <div className="bg-[#bfebd4]/30 dark:bg-[#1a3830]/30 border-r-4 border-[#0e5e6f] px-3 py-1.5 rounded-lg text-xs mb-1 max-w-full opacity-85 w-full">
                        <span className="block font-black text-[10px] text-[#0e5e6f] dark:text-[#bfebd4] mb-0.5">رد على {msg.replyTo.senderName}:</span>
                        <p className="truncate text-slate-800 dark:text-slate-200">{msg.replyTo.text}</p>
                      </div>
                    )}

                    <div className={`relative group px-3.5 md:px-4 py-2.5 md:py-3 rounded-2xl text-right leading-relaxed shadow-sm border-2
                        ${msg.deleted
                        ? 'bg-slate-100/40 dark:bg-slate-900/40 text-slate-500 italic border-dashed border-slate-300 dark:border-slate-800'
                        : isMe
                          ? 'bg-gradient-to-br from-[#0e5e6f] to-[#178a9e] text-white border-[#0e5e6f] rounded-tl-none'
                          : (msg.mentions?.includes(profile.uid) || msg.mentions?.includes('admin_support') && profile.role === 'admin')
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700/50 rounded-tr-none ring-2 ring-amber-400 dark:ring-amber-500 animate-pulse-once'
                            : 'bg-white dark:bg-[#0d2328] text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-800 rounded-tr-none'}
                      `}>

                      {/* Message Text with WhatsApp-style bottom layout for Time & Seen status */}
                      <div className="flex flex-col">
                        <p className="text-sm font-semibold leading-relaxed break-words">{msg.text}</p>
                        {!msg.deleted && msg.timestamp && (
                          <div className={`flex items-center justify-end gap-1.5 mt-1 select-none ${isMe ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                            <span className="text-[9px] font-extrabold leading-none">
                              {getFormattedTime(msg.timestamp)}
                            </span>
                            {activeTab === 'private' && isMe && (
                              <span className="flex items-center leading-none">
                                {msg.read ? (
                                  <span className="text-sky-300 font-extrabold text-[10px] leading-none drop-shadow" title="مقروءة">✓✓</span>
                                ) : (selectedFriend?.status === 'online' ? (
                                  <span className="text-slate-100 font-extrabold text-[10px] leading-none" title="مستلمة">✓✓</span>
                                ) : (
                                  <span className="text-white/40 font-extrabold text-[10px] leading-none" title="مرسلة">✓</span>
                                ))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions display at bottom of bubble */}
                      {Object.keys(reactions).some(e => reactions[e]?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.keys(reactions).map(emoji => {
                            const count = reactions[emoji]?.length || 0;
                            if (count === 0) return null;
                            const hasReacted = reactions[emoji]?.includes(profile.uid);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg, emoji)}
                                className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black border flex items-center gap-1 transition ${hasReacted ? 'bg-[#bfebd4] text-[#0e5e6f] border-[#0e5e6f]' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Desktop Hover & Mobile Long-Press Reaction Bar */}
                      {!msg.deleted && (
                        <div className={`absolute -top-10 z-30 flex-row items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 rounded-full shadow-lg border-2 border-[#82af96] dark:border-[#3c6550]
                            ${activeReactionMsgId === msg.id ? 'flex' : 'hidden group-hover:hidden md:group-hover:flex'} 
                            ${isMe ? 'left-0' : 'right-0'}
                            after:content-[''] after:absolute after:w-full after:h-6 after:-bottom-6 after:left-0`}
                        >

                          {/* Emoji quick reaction dots */}
                          <div className="flex gap-1 border-l pl-1.5 border-slate-200 dark:border-slate-800">
                            {REACTION_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg, emoji)}
                                className="text-sm hover:scale-130 transition active:scale-95 px-1"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => { setReplyTarget(msg); setActiveReactionMsgId(null); }}
                            title="رد واقتباس"
                            className="p-1.5 text-[#0e5e6f] dark:text-[#bfebd4] hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <CornerUpLeft size={14} />
                          </button>
                          {!isMe && (
                            <button
                              type="button"
                              onClick={() => { setReportingMsg(msg); setActiveReactionMsgId(null); }}
                              title="إبلاغ للإدارة"
                              className="p-1.5 text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                              <Flag size={14} />
                            </button>
                          )}
                          {(isMe || (activeTab === 'group' && profile.role === 'admin')) && (
                            <button
                              type="button"
                              onClick={() => { deleteMessage(msg.id, activeTab === 'private'); setActiveReactionMsgId(null); }}
                              title={profile.role === 'admin' && !isMe ? "حذف كمسؤول" : "حذف للجميع"}
                              className="p-1.5 text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Overlay to close mobile reaction menu if clicked outside bubble */}
                      {activeReactionMsgId === msg.id && (
                        <div
                          className="fixed inset-0 z-10 hidden sm:hidden"
                          onClick={(e) => { e.stopPropagation(); setActiveReactionMsgId(null); }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing status display */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[10px] italic font-black text-emerald-600 dark:text-emerald-400 bg-white/30 dark:bg-black/10 text-right animate-pulse">
          ✍️ {typingUsers.join(' و ')} {typingUsers.length > 1 ? 'يكتبون الآن...' : 'يكتب الآن...'}
        </div>
      )}

      {/* Bottom Quoted Reply Banner */}
      {replyTarget && (
        <div className="px-4 py-2 bg-[#bfebd4]/40 dark:bg-[#1a3830]/40 flex items-center justify-between border-t border-[#82af96] dark:border-[#3c6550] text-right">
          <div className="text-xs">
            <span className="block font-black text-[#0e5e6f] dark:text-[#bfebd4]">رد على رسالة {replyTarget.senderName}:</span>
            <p className="text-slate-700 dark:text-slate-300 truncate max-w-lg">{replyTarget.text}</p>
          </div>
          <button type="button" onClick={() => setReplyTarget(null)} className="p-1 rounded-full hover:bg-slate-200">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Send Form & Custom Emoji selector panel */}
      {(activeTab !== 'private' || selectedFriend) && (
        <div className="p-4 bg-white/60 dark:bg-[#09171a]/60 border-t border-[#82af96] dark:border-[#3c6550] backdrop-blur-md relative">

          {/* Quick Emoji bar */}
          {mentionQuery !== null && mentionList.length > 0 && (
            <div className="absolute bottom-16 right-16 w-64 bg-white dark:bg-[#0d2328] rounded-xl border border-[#82af96] dark:border-[#3c6550] shadow-xl z-40 overflow-hidden text-right">
              {mentionList.map((student, idx) => (
                <button
                  key={student.uid}
                  type="button"
                  onClick={() => insertMention(student)}
                  className={`w-full text-right px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${idx === mentionCursorIndex ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                    <img src={getFriendAvatar(student)} alt={student.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {student.name}
                    {(student.role === 'admin' || student.role === 'helper') && <VerifiedBadge />}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Emoji bar */}
          {showEmojiPicker && (
            <div className="absolute bottom-16 right-4 w-76 p-3 bg-white dark:bg-[#0d2328] rounded-2xl border-2 border-[#82af96] dark:border-[#3c6550] shadow-2xl z-30 fade-in text-right">
              {/* Horizontal Category Selectors */}
              <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 mb-2 overflow-x-auto select-none no-scrollbar">
                {EMOJI_CATEGORIES.map((cat, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedEmojiCategoryIdx(idx)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition shrink-0 ${selectedEmojiCategoryIdx === idx ? 'bg-[#0e5e6f] text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:bg-slate-200'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Emojis Grid Panel */}
              <div className="grid grid-cols-7 gap-2 max-h-44 overflow-y-auto p-0.5 justify-items-center">
                {EMOJI_CATEGORIES[selectedEmojiCategoryIdx].emojis.map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNewMessage(prev => prev + emoji);
                    }}
                    className="text-xl hover:scale-130 transition duration-100 flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-800 bg-white/95 dark:bg-[#0d2328] flex items-center justify-center hover:scale-105 transition shrink-0 text-[#0e5e6f] dark:text-[#bfebd4] shadow-sm"
            >
              <Smile size={20} />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (mentionQuery !== null && mentionList.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionCursorIndex(prev => (prev + 1) % mentionList.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setMentionCursorIndex(prev => (prev - 1 + mentionList.length) % mentionList.length);
                  } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertMention(mentionList[mentionCursorIndex]);
                  } else if (e.key === 'Escape') {
                    setMentionQuery(null);
                  }
                }
              }}
              placeholder="اكتب رسالتك الجامعية هنا..."
              className="flex-1 input-academic font-black border-2 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-[#0e5e6f] text-xs md:text-sm"
            />

            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="w-12 h-12 rounded-full bg-[#0e5e6f] hover:bg-[#178a9e] text-white flex items-center justify-center hover:scale-105 transition disabled:opacity-50 shrink-0 shadow-md"
            >
              <svg className="w-5 h-5 transform rotate-180 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>

    {/* Report Modal */}
    {reportingMsg && (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border-2 border-orange-500/30">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 shrink-0">
                <Flag size={20} />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">إبلاغ للإدارة</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">سيتم مراجعة الرسالة من قبل الإدارة لاتخاذ الإجراء المناسب.</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mb-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">الرسالة المُبلّغ عنها:</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{reportingMsg.text}</p>
              <p className="text-[10px] text-slate-500 mt-1">بواسطة: {reportingMsg.senderName}</p>
            </div>

            <form onSubmit={handleReportSubmit}>
              <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2">
                سبب الإبلاغ
              </label>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="أكتب سبب الإبلاغ بوضوح (مثال: ألفاظ غير لائقة، تنمر، محتوى غير مناسب...)"
                className="w-full input-academic rounded-xl p-3 h-24 resize-none mb-6 text-sm"
                required
              />

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!reportReason.trim() || reportSubmitting}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {reportSubmitting ? 'جاري الإرسال...' : 'إرسال البلاغ'}
                  {!reportSubmitting && <Flag size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => { setReportingMsg(null); setReportReason(''); }}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

  </div>
  );
}
