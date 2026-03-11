import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from './i18n';
import { DriveFile, getOrCreateAppFolder, listFiles, uploadFile, deleteFile, formatFileSize, getFileTypeIcon } from './driveService';
import { Task, Status, Priority, Comment } from './types';
import { manualContent, Language } from './manualContent';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { 
  LayoutDashboard, 
  Users, 
  AlertCircle, 
  Plus, 
  Calendar,
  Clock,
  CheckCircle2,
  AlertOctagon,
  MoreVertical,
  X,
  CalendarDays,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Home,
  CalendarClock,
  MessageSquare,
  FileText,
  Folder,
  ShieldAlert,
  Eye,
  Edit3,
  Power,
  ClipboardList,
  FileArchive,
  Send,
  Mic,
  ListTodo,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Video
} from 'lucide-react';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, import.meta.env.VITE_FIRESTORE_DATABASE_ID || '');
const auth = getAuth();

const COLUMNS: Status[] = ['To Do', 'In Progress', 'Blocked', 'Done'];
const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('sync');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Comments State
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  const isThisWeek = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
    return d >= startOfWeek && d <= endOfWeek;
  };

  // Calendar State
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Google Drive State
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Automation State
  const [aiInputText, setAiInputText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const handleAiAction = async (type: 'meeting' | 'action') => {
    if (!aiInputText.trim()) return;
    setIsAiLoading(true);
    setAiResult(null);
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key is not configured.");
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let prompt = "";
      if (type === 'meeting') {
        prompt = `다음 회의록 또는 텍스트를 분석하여 핵심 안건과 결정 사항을 3~5개의 글머리 기호(Bullet points) 문장으로 요약해주세요. 각 문장은 반드시 '- '로 시작해야 합니다. 불필요한 서술 없이 목록만 일목요연하게 출력해주세요.\n\n텍스트:\n${aiInputText}`;
      } else {
        prompt = `다음 회의록 또는 텍스트를 분석하여 담당자별로 해야 할 일(Action Items)을 추출해주세요. 담당자가 명확하지 않으면 적절히 추론하거나 생략하세요. 결과는 3~5개의 글머리 기호(Bullet points) 문장으로만 응답하고 각 문장은 반드시 '- [역할/담당자] 할 일 일정(있다면)' 형식이어야 합니다. 불필요한 서술 없이 목록만 일목요연하게 출력해주세요.\n\n텍스트:\n${aiInputText}`;
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      const items = responseText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-') || line.startsWith('*'))
        .map(line => line.replace(/^[-*]\s*/, ''));

      if (type === 'meeting') {
        setAiResult({ type: 'meeting', summary: items.length > 0 ? items : ["요약할 내용을 명확하게 찾지 못했습니다."] });
      } else {
        setAiResult({ type: 'action', actions: items.length > 0 ? items : ["추출할 확인 가능한 액션아이템이 없습니다."] });
      }
    } catch (error) {
      console.error("AI Error:", error);
      const fallbackMsg = "AI 분석 중 오류가 발생했습니다. API 키나 설정 상태를 확인해 주세요.";
      setAiResult({
        type: type,
        ...(type === 'meeting' ? { summary: [fallbackMsg] } : { actions: [fallbackMsg] })
      });
    } finally {
      setIsAiLoading(false);
    }
  };
  // Test Firestore Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Tasks and Comments Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(newTasks);
    }, (error) => {
      console.error("Firestore Tasks Error:", error);
    });

    const unsubscribeComments = onSnapshot(collection(db, 'comments'), (snapshot) => {
      const newComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      newComments.sort((a,b) => b.createdAt - a.createdAt);
      setComments(newComments);
    }, (error) => {
      console.error("Firestore Comments Error:", error);
    });
    
    return () => { 
      unsubscribeTasks(); 
      unsubscribeComments(); 
    };
  }, [isAuthReady, user]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      await setDoc(doc(collection(db, 'comments')), {
        text: newComment,
        authorId: user.uid,
        authorName: user.displayName || 'User',
        authorPhotoURL: user.photoURL || null,
        createdAt: Date.now()
      });
      setNewComment("");
    } catch (err) {
      console.error(err);
    }
  };

  // Calendar Events Fetcher
  useEffect(() => {
    if (isCalendarConnected && googleAccessToken) {
      fetchCalendarEvents(currentMonth);
    }
  }, [currentMonth, isCalendarConnected, googleAccessToken]);

  const { t, language, setLanguage } = useLanguage();

  const menuCategories = [
    {
      title: t('nav.companyHome'),
      items: [
        { id: 'sync', label: t('nav.item.today'), icon: <Clock className="w-[18px] h-[18px]" /> },
        { id: 'deadline', label: t('nav.item.deadline'), icon: <CalendarClock className="w-[18px] h-[18px]" /> },
        { id: 'issues', label: t('nav.item.issues'), icon: <AlertOctagon className="w-[18px] h-[18px]" />, badge: tasks.filter(t => t.status === 'Blocked').length },
        { id: 'comments', label: t('nav.item.comments'), icon: <MessageSquare className="w-[18px] h-[18px]" /> },
        { id: 'meetings', label: t('nav.item.meetings'), icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'docs', label: t('nav.item.docs'), icon: <FileText className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: t('nav.projectCenter'),
      items: [
        { id: 'projects', label: t('nav.item.projects'), icon: <Folder className="w-[18px] h-[18px]" /> },
        { id: 'board', label: t('nav.item.board'), icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
        { id: 'calendar', label: t('nav.item.calendar'), icon: <CalendarDays className="w-[18px] h-[18px]" /> },
        { id: 'risks', label: t('nav.item.risks'), icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
        { id: 'assignees', label: t('nav.item.assignees'), icon: <Users className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: t('nav.feedbackCenter'),
      items: [
        { id: 'review_req', label: t('nav.item.reviewRequest'), icon: <Eye className="w-[18px] h-[18px]" /> },
        { id: 'revision_req', label: t('nav.item.editRequest'), icon: <Edit3 className="w-[18px] h-[18px]" /> },
        { id: 'pending_appr', label: t('nav.item.pendingApproval'), icon: <Clock className="w-[18px] h-[18px]" /> },
        { id: 'completion_log', label: t('nav.item.completedLogs'), icon: <CheckCircle2 className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: t('nav.manual'),
      items: [
        { id: 'manual_routine', label: t('nav.item.workRoutine'), icon: <Power className="w-[18px] h-[18px]" /> },
        { id: 'manual_req_rules', label: t('nav.item.requestRules'), icon: <ClipboardList className="w-[18px] h-[18px]" /> },
        { id: 'manual_meet_rules', label: t('nav.item.meetingRules'), icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'manual_file_rules', label: t('nav.item.fileRules'), icon: <FileArchive className="w-[18px] h-[18px]" /> },
        { id: 'manual_deploy_check', label: t('nav.item.deployChecklist'), icon: <Send className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: t('nav.aiAutomation'),
      items: [
        { id: 'ai_meeting', label: t('nav.item.summaryMeetings'), icon: <Mic className="w-[18px] h-[18px]" /> },
        { id: 'ai_action', label: t('nav.item.extractActions'), icon: <ListTodo className="w-[18px] h-[18px]" /> },
        { id: 'ai_weekly', label: t('nav.item.weeklySummary'), icon: <BarChart3 className="w-[18px] h-[18px]" /> },
        { id: 'ai_delay', label: t('nav.item.delayWarning'), icon: <AlertTriangle className="w-[18px] h-[18px]" /> },
        { id: 'ai_blocker', label: t('nav.item.blockedAlert'), icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
      ]
    }
  ];

  const activeMenu = menuCategories.flatMap(c => c.items).find(i => i.id === activeTab);
  const activeMenuLabel = activeMenu?.label || 'Dashboard';

  const currentManualKey = activeTab.startsWith('manual_') ? activeTab.replace('manual_', '') : null;
  const manualData = currentManualKey ? (manualContent[language as Language] || manualContent['ko'])[currentManualKey] : null;

  // Google Drive: load files when docs tab selected
  const loadDriveFiles = useCallback(async () => {
    if (!googleAccessToken) return;
    setIsDriveLoading(true);
    try {
      const fId = driveFolderId || await getOrCreateAppFolder(googleAccessToken);
      if (!driveFolderId) setDriveFolderId(fId);
      const files = await listFiles(googleAccessToken, fId);
      setDriveFiles(files);
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') {
        setGoogleAccessToken(null);
      }
      console.error('Drive error:', e);
    } finally {
      setIsDriveLoading(false);
    }
  }, [googleAccessToken, driveFolderId]);

  useEffect(() => {
    if (activeTab === 'docs' && googleAccessToken) {
      loadDriveFiles();
    }
  }, [activeTab, googleAccessToken, loadDriveFiles]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !googleAccessToken) return;
    setIsUploading(true);
    try {
      const fId = driveFolderId || await getOrCreateAppFolder(googleAccessToken);
      if (!driveFolderId) setDriveFolderId(fId);
      for (const file of Array.from(files)) {
        await uploadFile(googleAccessToken, fId, file);
      }
      await loadDriveFiles();
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') setGoogleAccessToken(null);
      console.error('Upload error:', e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!googleAccessToken || !confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) return;
    try {
      await deleteFile(googleAccessToken, fileId);
      setDriveFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') setGoogleAccessToken(null);
      console.error('Delete error:', e);
    }
  };

  const updateFeedbackStatus = async (taskId: string, newFeedbackStatus: Task['feedbackStatus'], newStatus?: Status) => {
    try {
      const updates: Partial<Task> = { feedbackStatus: newFeedbackStatus };
      if (newStatus) {
        updates.status = newStatus;
        if (newStatus === 'Done') {
          updates.completedAt = Date.now();
        }
      }
      await setDoc(doc(collection(db, 'tasks'), taskId), updates, { merge: true });
      setIsModalOpen(false);
    } catch (e) {
      console.error('Error updating feedback status:', e);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        setIsCalendarConnected(true);
      }
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGoogleAccessToken(null);
      setIsCalendarConnected(false);
      setCalendarEvents([]);
      setTasks([]);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const fetchCalendarEvents = async (date: Date) => {
    if (!googleAccessToken) return;
    setIsLoadingEvents(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&orderBy=startTime&singleEvents=true&maxResults=250`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      
      if (res.status === 401) {
        setIsCalendarConnected(false);
        setGoogleAccessToken(null);
        return;
      }
      const data = await res.json();
      setCalendarEvents(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate || !user) return;

    try {
      await setDoc(doc(db, 'tasks', taskId), {
        ...taskToUpdate,
        status
      });
    } catch (error) {
      console.error("Error updating task status:", error);
      alert("Failed to update task. Please check permissions.");
    }
  };

  const saveTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!user) return;
    
    try {
      if (editingTask && editingTask.id) {
        // Update existing
        const updatedTask = {
          ...editingTask,
          ...taskData
        };
        await setDoc(doc(db, 'tasks', editingTask.id), updatedTask);
      } else {
        // Create new
        const newId = Math.random().toString(36).substring(2, 9);
        const newTask = {
          ...taskData,
          createdAt: Date.now(),
          createdBy: user.uid
        };
        await setDoc(doc(db, 'tasks', newId), newTask);
      }
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error("Error saving task:", error);
      alert("Failed to save task. Please check permissions.");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. You can only delete tasks you created.");
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const openCreateModal = (status: Status = 'To Do') => {
    setEditingTask({
      id: '',
      title: '',
      description: '',
      assignee: user?.displayName || '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      status,
      createdAt: 0,
      createdBy: ''
    });
    setIsModalOpen(true);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const headers = weekDays.map(day => (
      <div key={day} className="text-center font-semibold text-sm text-slate-500 py-2 border-b border-slate-200">
        {day}
      </div>
    ));

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/50 border-b border-r border-slate-100 p-2"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      const dayEvents = calendarEvents.filter(e => {
        const eventStart = e.start?.dateTime || e.start?.date;
        return eventStart && eventStart.startsWith(dateStr);
      });

      const todayStr = new Date().toLocaleDateString('en-CA');
      const isToday = todayStr === dateStr;

      days.push(
        <div key={i} className={`min-h-[100px] border-b border-r border-slate-100 p-2 transition-colors hover:bg-slate-50 ${isToday ? 'bg-indigo-50/30' : 'bg-white'}`}>
          <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
            {i}
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 4).map(event => {
              const isAllDay = !event.start?.dateTime;
              const timeString = isAllDay ? '' : new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={event.id} className="text-[10px] leading-tight bg-indigo-100 text-indigo-800 px-1.5 py-1 rounded truncate cursor-pointer hover:bg-indigo-200" title={event.summary}>
                  {timeString && <span className="font-semibold mr-1">{timeString}</span>}
                  {event.summary || 'Untitled'}
                </div>
              );
            })}
            {dayEvents.length > 4 && (
              <div className="text-[10px] text-slate-500 font-medium px-1">
                +{dayEvents.length - 4} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-slate-800">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-white hover:shadow-sm transition-all text-slate-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-2 py-1 text-xs font-medium rounded hover:bg-white hover:shadow-sm transition-all text-slate-600">
                Today
              </button>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-white hover:shadow-sm transition-all text-slate-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 bg-slate-50">
          {headers}
        </div>
        <div className="grid grid-cols-7 flex-1 overflow-y-auto auto-rows-fr">
          {days}
        </div>
      </div>
    );
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Fast-Track Agile</h1>
          <p className="text-slate-500 mb-8">Sign in to access your team's Kanban board and sync your Google Calendar.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-[280px] bg-white border-r border-slate-200 flex flex-col shrink-0 drop-shadow-sm z-20">
        <div className="p-6 border-b border-slate-100/80 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
                Fast-Track
              </h1>
              <p className="text-[11px] font-medium text-slate-500 leading-tight">Agile Workspace</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto w-full p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          {menuCategories.map((category, idx) => (
            <div key={category.title} className={idx > 0 ? "mt-6" : ""}>
              <h3 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2 px-3">
                {category.title}
              </h3>
              <div className="space-y-0.5">
                {category.items.map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'docs') {
                          window.open('https://drive.google.com/drive/folders/1A9Oms1S0tbJEWD3QfEivyDFj4FCPjTc9?usp=drive_link', '_blank');
                        } else {
                          setActiveTab(item.id);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 group relative outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        isActive 
                          ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r-full shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>
                      )}
                      <div className={`${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} transition-colors duration-200`}>
                        {item.icon}
                      </div>
                      {item.label}
                      {(item.badge ?? 0) > 0 && (
                        <span className={`ml-auto py-0.5 px-2 rounded-full text-[10px] font-bold shadow-sm ${
                          isActive 
                            ? 'bg-indigo-200 text-indigo-800' 
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-100 bg-white min-h-[68px] flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between px-2 w-full">
            <div className="flex bg-slate-100 rounded-lg p-1 w-full relative">
              <div 
                className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-md shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${language === 'en' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
              ></div>
              <button
                onClick={() => setLanguage('ko')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold tracking-wide rounded-md transition-colors relative z-10 ${language === 'ko' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🇰🇷 한국어
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold tracking-wide rounded-md transition-colors relative z-10 ${language === 'en' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🇺🇸 English
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 px-2 hover:bg-slate-50 p-2 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-9 h-9 rounded-full ring-2 ring-white shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{user.displayName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate leading-tight">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors" title={t('auth.logout')}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0 sticky top-0 z-10 transition-all drop-shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {activeMenuLabel}
            </h2>
          </div>
          {['board', 'sync', 'issues'].includes(activeTab) && (
            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              {t('board.newTask')}
            </button>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8 relative">
          {activeTab === 'board' && (
            <div className="flex gap-6 h-full items-start overflow-x-auto pb-4">
              {COLUMNS.map(column => (
                <div 
                  key={column}
                  className="flex-shrink-0 w-80 bg-slate-100/50 rounded-xl border border-slate-200 flex flex-col max-h-full"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column)}
                >
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100/80 rounded-t-xl">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                      {column === 'To Do' && <div className="w-2 h-2 rounded-full bg-slate-400" />}
                      {column === 'In Progress' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      {column === 'Blocked' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                      {column === 'Done' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      {column}
                    </h3>
                    <span className="bg-white text-slate-500 text-xs font-medium px-2 py-1 rounded-full shadow-sm border border-slate-200">
                      {tasks.filter(t => t.status === column).length}
                    </span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    {tasks.filter(t => t.status === column).map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onDragStart={handleDragStart}
                        onClick={() => openEditModal(task)}
                      />
                    ))}
                    <button 
                      onClick={() => openCreateModal(column)}
                      className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors border border-dashed border-slate-300"
                    >
                      <Plus className="w-4 h-4" /> Add Task
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  {t('home.todayTasks')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <h4 className="font-medium text-emerald-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {t('board.done')}
                    </h4>
                    <ul className="space-y-2">
                      {tasks.filter(t => t.status === 'Done').slice(0, 5).map(t => (
                        <li key={t.id} className="text-sm text-emerald-700 bg-white px-3 py-2 rounded shadow-sm border border-emerald-100">
                          <span className="font-medium">{t.assignee}:</span> {t.title}
                        </li>
                      ))}
                      {tasks.filter(t => t.status === 'Done').length === 0 && (
                        <li className="text-sm text-emerald-600/70 italic">{t('home.noTasks')}</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {t('board.inProgress')}
                    </h4>
                    <ul className="space-y-2">
                      {tasks.filter(t => t.status === 'In Progress').map(t => (
                        <li key={t.id} className="text-sm text-blue-700 bg-white px-3 py-2 rounded shadow-sm border border-blue-100">
                          <span className="font-medium">{t.assignee}:</span> {t.title}
                        </li>
                      ))}
                      {tasks.filter(t => t.status === 'In Progress').length === 0 && (
                        <li className="text-sm text-blue-600/70 italic">{t('home.noTasks')}</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4" /> {t('board.blocked')}
                    </h4>
                    <ul className="space-y-2">
                      {tasks.filter(t => t.status === 'Blocked').map(t => (
                        <li key={t.id} className="text-sm text-red-700 bg-white px-3 py-2 rounded shadow-sm border border-red-100">
                          <span className="font-medium">{t.assignee}:</span> {t.title}
                        </li>
                      ))}
                      {tasks.filter(t => t.status === 'Blocked').length === 0 && (
                        <li className="text-sm text-red-600/70 italic">{t('issues.goodJob')}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                 <h3 className="text-lg font-semibold mb-4">Team Workload</h3>
                 <div className="space-y-4">
                   {Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))).map(assignee => {
                     const userTasks = tasks.filter(t => t.assignee === assignee);
                     const done = userTasks.filter(t => t.status === 'Done').length;
                     const inProgress = userTasks.filter(t => t.status === 'In Progress').length;
                     const blocked = userTasks.filter(t => t.status === 'Blocked').length;
                     const todo = userTasks.filter(t => t.status === 'To Do').length;
                     
                     return (
                       <div key={assignee} className="flex items-center gap-4">
                         <div className="w-24 font-medium text-slate-700">{assignee}</div>
                         <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
                           {done > 0 && <div style={{width: `${(done/userTasks.length)*100}%`}} className="bg-emerald-500 h-full" title={`${done} Done`} />}
                           {inProgress > 0 && <div style={{width: `${(inProgress/userTasks.length)*100}%`}} className="bg-blue-500 h-full" title={`${inProgress} In Progress`} />}
                           {blocked > 0 && <div style={{width: `${(blocked/userTasks.length)*100}%`}} className="bg-red-500 h-full" title={`${blocked} Blocked`} />}
                           {todo > 0 && <div style={{width: `${(todo/userTasks.length)*100}%`}} className="bg-slate-300 h-full" title={`${todo} To Do`} />}
                         </div>
                         <div className="w-12 text-right text-sm text-slate-500">{userTasks.length} tasks</div>
                       </div>
                     )
                   })}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Critical Issues & Blockers
                  </h3>
                </div>
                <div className="divide-y divide-slate-200">
                  {tasks.filter(t => t.status === 'Blocked' || t.priority === 'High').sort((a, b) => {
                    if (a.status === 'Blocked' && b.status !== 'Blocked') return -1;
                    if (a.status !== 'Blocked' && b.status === 'Blocked') return 1;
                    return 0;
                  }).map(task => (
                    <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4">
                      <div className="mt-1">
                        {task.status === 'Blocked' ? (
                          <AlertOctagon className="w-5 h-5 text-red-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-orange-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{task.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            task.status === 'Blocked' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {task.status === 'Blocked' ? 'Blocked' : 'High Priority'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {task.assignee || 'Unassigned'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Due: {task.dueDate || 'No date'}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              task.status === 'To Do' ? 'bg-slate-400' :
                              task.status === 'In Progress' ? 'bg-blue-500' :
                              task.status === 'Blocked' ? 'bg-red-500' : 'bg-emerald-500'
                            }`} />
                            Current Status: {task.status}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => openEditModal(task)}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  ))}
                  {tasks.filter(t => t.status === 'Blocked' || t.priority === 'High').length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                      <p>No critical issues or blockers right now.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="h-full">
              {!isCalendarConnected ? (
                <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center mt-8">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 mb-2">Connect your Calendar</h4>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    Sign in with Google again to grant Calendar access and view your schedule directly inside the app.
                  </p>
                  <button
                    onClick={handleLogin}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Grant Calendar Access
                  </button>
                </div>
              ) : (
                isLoadingEvents ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  renderCalendarGrid()
                )
              )}
            </div>
          )}

          {/* Google Drive - 문서 바로가기 */}
          {activeTab === 'docs' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {!googleAccessToken ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 mb-2">Google Drive 연결</h4>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    Google Drive에 파일을 저장하고 팀과 공유하세요. 로그인 시 Drive 접근 권한이 필요합니다.
                  </p>
                  <button onClick={handleLogin} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                    <ExternalLink className="w-4 h-4" /> Drive 연결하기
                  </button>
                </div>
              ) : (
                <>
                  {/* Upload area */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFileUpload(e.dataTransfer.files); }}
                    className={`bg-white rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 ${
                      isDragOver ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' : 'border-slate-200'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      {isUploading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                      ) : (
                        <Plus className="w-6 h-6 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {isUploading ? '업로드 중...' : '파일을 드래그하거나 클릭하여 업로드'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Google Drive "Fast-Track Agile" 폴더에 저장됩니다</p>
                  </div>

                  {/* File list */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-500" />
                        파일 목록
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{driveFiles.length}</span>
                      </h3>
                      <button
                        onClick={loadDriveFiles}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> 새로고침
                      </button>
                    </div>

                    {isDriveLoading ? (
                      <div className="p-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="p-12 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">아직 업로드된 파일이 없습니다</p>
                        <p className="text-xs mt-1">위 영역을 클릭하여 파일을 업로드해 보세요</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {driveFiles.map(file => (
                          <div key={file.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                            <span className="text-xl w-8 text-center flex-shrink-0">{getFileTypeIcon(file.mimeType)}</span>
                            <div className="flex-1 min-w-0">
                              <a
                                href={file.webViewLink || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-slate-800 hover:text-indigo-600 truncate block transition-colors"
                              >
                                {file.name}
                              </a>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{new Date(file.modifiedTime).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={file.webViewLink || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Google Drive에서 열기"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleDeleteFile(file.id, file.name)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                title="삭제"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Deadline state */}
          {activeTab === 'deadline' && (
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-indigo-500" />
                    이번 주 마감 태스크
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">이번 주에 마감되는 작업 목록입니다.</p>
                </div>
                <div className="divide-y divide-slate-200">
                  {tasks.filter(t => isThisWeek(t.dueDate)).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(task => (
                    <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{task.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            task.priority === 'High' ? 'bg-red-100 text-red-700' : 
                            task.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {t(`board.priority.${task.priority.toLowerCase()}`)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-semibold text-red-600">
                            <Calendar className="w-3 h-3" /> 마감: {task.dueDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {task.assignee || '미지정'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => openEditModal(task)}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                      >
                        상세보기
                      </button>
                    </div>
                  ))}
                  {tasks.filter(t => isThisWeek(t.dueDate)).length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
                      <p className="font-medium text-slate-600">이번 주에 마감되는 작업이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Comments state */}
          {activeTab === 'comments' && (
            <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)]">
              <div className="bg-white rounded-t-xl border border-slate-200 shadow-sm p-6 border-b shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                    팀 코멘트
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">팀원들과 자유롭게 의견을 나누세요.</p>
                </div>
                <div className="text-sm text-slate-500 font-medium">총 {comments.length}개의 코멘트</div>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-4 border-l border-r border-slate-200">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                    <p>첫 번째 코멘트를 남겨보세요!</p>
                  </div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                      <img src={comment.authorPhotoURL || `https://ui-avatars.com/api/?name=${comment.authorName}`} alt="Profile" className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-slate-800">{comment.authorName}</span>
                          <span className="text-[11px] text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm p-4 shrink-0">
                <form onSubmit={handleCommentSubmit} className="flex gap-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="팀에 코멘트 남기기..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                  />
                  <button 
                    type="submit" 
                    disabled={!newComment.trim()}
                    className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> 작성
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Meetings state */}
          {activeTab === 'meetings' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      예정된 회의 일정
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Google Calendar와 동기화된 이벤트 목록입니다.</p>
                  </div>
                  {!isCalendarConnected && (
                    <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors border border-blue-200">
                      <Calendar className="w-4 h-4" /> 캘린더 연동하기
                    </button>
                  )}
                </div>
                {isCalendarConnected ? (
                  <div className="divide-y divide-slate-100">
                    {isLoadingEvents ? (
                      <div className="p-8 text-center text-slate-500">일정을 불러오는 중입니다...</div>
                    ) : calendarEvents.length > 0 ? (
                      calendarEvents.map((event, i) => {
                        const isToday = new Date(event.start.dateTime || event.start.date).toDateString() === new Date().toDateString();
                        return (
                          <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4">
                            <div className={`mt-1 flex-shrink-0 w-12 text-center flex flex-col ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                              <span className="text-xs font-semibold uppercase">{new Date(event.start.dateTime || event.start.date).toLocaleString('en-US', { month: 'short' })}</span>
                              <span className="text-2xl font-bold leading-none">{new Date(event.start.dateTime || event.start.date).getDate()}</span>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-slate-900 line-clamp-1">{event.summary || '제목 없음'}</h4>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {event.start.dateTime 
                                    ? `${new Date(event.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(event.end.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                    : '종일 일정'
                                  }
                                </span>
                                {event.hangoutLink && (
                                  <a href={event.hangoutLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                    <Video className="w-3 h-3" /> 화상 회의 참석
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-10 text-center text-slate-500">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-medium text-slate-600">예정된 일정이 없습니다.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-500 bg-slate-50/50">
                    <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-600">Google Calendar 연동이 필요합니다.</p>
                    <p className="text-sm mt-1">상단의 '캘린더 연동하기' 버튼을 클릭하세요.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Projects state */}
          {activeTab === 'projects' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <Folder className="w-5 h-5 text-indigo-500" />
                      프로젝트 목록
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">현재 진행 중인 프로젝트의 전반적인 상태를 확인합니다.</p>
                  </div>
                </div>
                <div className="p-6">
                  {/* Single Default Project for MVP */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                     <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-start">
                        <div>
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Active</span>
                          <h4 className="text-xl font-bold text-slate-800 mt-3 mb-1">Fast-Track Agile Development</h4>
                          <p className="text-sm text-slate-500">칸반 보드와 구글 드라이브 통합을 통한 최우선 애자일 시스템 도입</p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black text-slate-800 mb-1">
                            {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'Done').length / tasks.length) * 100) : 0}%
                          </div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overall Progress</p>
                        </div>
                     </div>
                     <div className="p-6 grid grid-cols-4 gap-4 bg-white">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center">
                           <span className="text-2xl font-bold text-slate-700">{tasks.filter(t => t.status === 'To Do').length}</span>
                           <span className="text-xs font-semibold text-slate-500 uppercase mt-1 tracking-wider">To Do</span>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-col items-center justify-center">
                           <span className="text-2xl font-bold text-blue-700">{tasks.filter(t => t.status === 'In Progress').length}</span>
                           <span className="text-xs font-semibold text-blue-500 uppercase mt-1 tracking-wider">In Progress</span>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col items-center justify-center">
                           <span className="text-2xl font-bold text-emerald-700">{tasks.filter(t => t.status === 'Done').length}</span>
                           <span className="text-xs font-semibold text-emerald-500 uppercase mt-1 tracking-wider">Done</span>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center justify-center relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-8 h-8 bg-red-100 rounded-bl-full shadow-sm flex items-start justify-end pr-1.5 pt-1.5">
                             <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                           </div>
                           <span className="text-2xl font-bold text-red-700">{tasks.filter(t => t.status === 'Blocked').length}</span>
                           <span className="text-xs font-semibold text-red-500 uppercase mt-1 tracking-wider">Blocked</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Risks state */}
          {activeTab === 'risks' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    리스크 보드
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">위험도가 높거나 진행이 차단된 특별 관리 대상 작업들입니다.</p>
                </div>
                <div className="flex-1 bg-slate-50/50 p-6 flex items-start justify-center">
                  <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Critical Risks */}
                    <div className="bg-red-50/50 rounded-xl border border-red-200 shadow-sm overflow-hidden">
                       <div className="bg-red-100/50 px-4 py-3 border-b border-red-200 flex justify-between items-center">
                          <h4 className="font-bold text-red-800 flex items-center gap-1.5">
                             <AlertOctagon className="w-4 h-4" /> Critical
                          </h4>
                          <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
                            {tasks.filter(t => t.status === 'Blocked' && t.priority === 'High').length}
                          </span>
                       </div>
                       <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
                         {tasks.filter(t => t.status === 'Blocked' && t.priority === 'High').map(task => (
                           <div key={task.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm select-text">
                              <p className="font-semibold text-slate-800 text-sm mb-1">{task.title}</p>
                              <p className="text-xs text-slate-500 mb-2">{task.assignee || '미지정'}</p>
                              <button onClick={() => openEditModal(task)} className="text-[11px] font-bold text-red-600 hover:text-red-800 uppercase tracking-widest">Resolve Now &rarr;</button>
                           </div>
                         ))}
                         {tasks.filter(t => t.status === 'Blocked' && t.priority === 'High').length === 0 && (
                            <div className="text-center p-4 text-xs font-medium text-red-400">No Critical Risks</div>
                         )}
                       </div>
                    </div>

                    {/* Moderate Risks */}
                    <div className="bg-orange-50/50 rounded-xl border border-orange-200 shadow-sm overflow-hidden">
                       <div className="bg-orange-100/50 px-4 py-3 border-b border-orange-200 flex justify-between items-center">
                          <h4 className="font-bold text-orange-800 flex items-center gap-1.5">
                             <AlertTriangle className="w-4 h-4" /> Moderate
                          </h4>
                          <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">
                            {tasks.filter(t => (t.status === 'Blocked' && t.priority !== 'High') || (t.status !== 'Blocked' && t.priority === 'High' && t.status !== 'Done')).length}
                          </span>
                       </div>
                       <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
                         {tasks.filter(t => (t.status === 'Blocked' && t.priority !== 'High') || (t.status !== 'Blocked' && t.priority === 'High' && t.status !== 'Done')).map(task => (
                           <div key={task.id} className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm select-text">
                              <p className="font-semibold text-slate-800 text-sm mb-1">{task.title}</p>
                              <p className="text-xs text-slate-500 mb-2">{task.assignee || '미지정'} • {task.status}</p>
                              <button onClick={() => openEditModal(task)} className="text-[11px] font-bold text-orange-600 hover:text-orange-800 uppercase tracking-widest">Review &rarr;</button>
                           </div>
                         ))}
                         {tasks.filter(t => (t.status === 'Blocked' && t.priority !== 'High') || (t.status !== 'Blocked' && t.priority === 'High' && t.status !== 'Done')).length === 0 && (
                            <div className="text-center p-4 text-xs font-medium text-orange-400">No Moderate Risks</div>
                         )}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assignees state */}
          {activeTab === 'assignees' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      담당자별 보기
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">팀원별 업무 강도와 진행 상태를 확인합니다.</p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))).map(assignee => {
                    const userTasks = tasks.filter(t => t.assignee === assignee);
                    const done = userTasks.filter(t => t.status === 'Done').length;
                    const inProgress = userTasks.filter(t => t.status === 'In Progress').length;
                    const blocked = userTasks.filter(t => t.status === 'Blocked').length;
                    const todo = userTasks.filter(t => t.status === 'To Do').length;
                    const total = userTasks.length;
                    const progress = Math.round((done / total) * 100);

                    return (
                      <div key={assignee} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-50 to-white -z-10 rounded-bl-full"></div>
                        <div className="flex items-center gap-3 mb-4">
                          <img src={`https://ui-avatars.com/api/?name=${assignee}&background=6366f1&color=fff`} alt={assignee} className="w-10 h-10 rounded-full shadow-sm" />
                          <div>
                            <h4 className="font-bold text-slate-800">{assignee}</h4>
                            <p className="text-xs font-medium text-slate-500">{total} Tasks Total</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden shadow-inner">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                               <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">To Do</span>
                               <span className="font-bold text-slate-700">{todo}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                               <span className="text-blue-500 text-xs font-semibold uppercase tracking-wider">Doing</span>
                               <span className="font-bold text-blue-700">{inProgress}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-red-50 border border-red-100">
                               <span className="text-red-500 text-xs font-semibold uppercase tracking-wider">Blocked</span>
                               <span className="font-bold text-red-700">{blocked}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                               <span className="text-emerald-600 text-xs font-semibold uppercase tracking-wider">Done</span>
                               <span className="font-bold text-emerald-700">{done}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))).length === 0 && (
                     <div className="col-span-full py-12 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>아직 담당자가 지정된 태스크가 없습니다.</p>
                     </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Feedback Center States */}
          {['review_req', 'revision_req', 'pending_appr'].includes(activeTab) && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    {activeTab === 'review_req' && <Eye className="w-5 h-5 text-indigo-500" />}
                    {activeTab === 'revision_req' && <Edit3 className="w-5 h-5 text-orange-500" />}
                    {activeTab === 'pending_appr' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    {t(activeTab === 'review_req' ? 'feedback.reviewReq' : activeTab === 'revision_req' ? 'feedback.revisionReq' : 'feedback.pendingAppr')}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {t(activeTab === 'review_req' ? 'feedback.reviewReqDesc' : activeTab === 'revision_req' ? 'feedback.revisionReqDesc' : 'feedback.pendingApprDesc')}
                  </p>
                </div>
                <div className="flex-1 bg-slate-50/50 p-6 flex items-start justify-center">
                  <div className="w-full max-w-2xl space-y-4">
                    {tasks.filter(t => t.feedbackStatus === (
                      activeTab === 'review_req' ? 'request_review' : 
                      activeTab === 'revision_req' ? 'request_revision' : 'pending_approval'
                    )).map(task => (
                      <div key={task.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between group hover:border-indigo-300 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              task.priority === 'High' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                              task.priority === 'Medium' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {t(`board.priority.${task.priority.toLowerCase()}`)}
                            </span>
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              {task.assignee}
                            </span>
                          </div>
                          <h4 className="font-semibold text-slate-800 text-lg mb-1">{task.title}</h4>
                          <p className="text-sm text-slate-500 line-clamp-2">{task.description}</p>
                        </div>
                        <button 
                          onClick={() => openEditModal(task)}
                          className="px-4 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 font-medium text-sm rounded-lg transition-colors whitespace-nowrap border border-transparent hover:border-indigo-100"
                        >
                          리뷰하기
                        </button>
                      </div>
                    ))}
                    {tasks.filter(t => t.feedbackStatus === (
                      activeTab === 'review_req' ? 'request_review' : 
                      activeTab === 'revision_req' ? 'request_revision' : 'pending_approval'
                    )).length === 0 && (
                      <div className="text-center py-20 text-slate-400">
                        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-20 text-indigo-500" />
                        <h4 className="text-lg font-medium text-slate-600">{t('feedback.none')}</h4>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Completion Logs State */}
          {activeTab === 'completion_log' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <FileArchive className="w-5 h-5 text-indigo-500" />
                      {t('feedback.completedLogs')}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">{t('feedback.completedLogsDesc')}</p>
                  </div>
                  <div className="text-sm font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                    Total: {tasks.filter(t => t.status === 'Done').length}
                  </div>
                </div>
                <div className="flex-1 bg-white p-6">
                  <div className="space-y-4 max-w-3xl mx-auto overflow-y-auto pr-2" style={{ maxHeight: '700px' }}>
                    {tasks.filter(t => t.status === 'Done').sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt)).map(task => (
                      <div key={task.id} className="group relative flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 ring-4 ring-emerald-50"></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{task.title}</h4>
                            <span className="text-[11px] font-medium text-slate-400">
                              {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : new Date(task.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-1 mb-2">{task.description}</p>
                          <div className="flex gap-2">
                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">{task.assignee}</span>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {tasks.filter(t => t.status === 'Done').length === 0 && (
                      <div className="text-center py-20 text-slate-400">
                        <FileArchive className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <h4 className="text-lg font-medium text-slate-600">완료된 태스크가 없습니다.</h4>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Operation Manual States */}
          {currentManualKey && manualData && (
             <div className="max-w-4xl mx-auto pb-20">
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[70vh]">
                 <div className="p-8 md:p-12 prose prose-slate prose-indigo max-w-none">
                    <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-6 not-prose">
                      <ListTodo className="w-6 h-6" />
                      <span className="tracking-wider uppercase text-sm">{t('manual.title')}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-8 pb-6 border-b border-slate-100">
                      {manualData.title}
                    </h1>
                    
                    {/* Notion-style Markdown Rendering (Simplified) */}
                    <div className="space-y-6 text-slate-700 leading-relaxed font-medium">
                      {manualData.content.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) {
                          return <h2 key={i} className="text-xl md:text-2xl font-bold text-slate-800 mt-10 mb-4 flex items-center gap-2">{line.replace('## ', '')}</h2>;
                        }
                        if (line.startsWith('- [ ]')) {
                          return (
                            <div key={i} className="flex items-start gap-3 my-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div className="w-5 h-5 rounded border-2 border-slate-300 mt-0.5 bg-white flex-shrink-0"></div>
                              <span dangerouslySetInnerHTML={{__html: line.replace('- [ ]', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>').replace(/`(.*?)`/g, '<code class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-sm">$1</code>')}} />
                            </div>
                          );
                        }
                        if (line.startsWith('- ')) {
                          return <li key={i} className="ml-5 my-1.5 list-disc marker:text-indigo-400" dangerouslySetInnerHTML={{__html: line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>')}} />;
                        }
                        if (line.match(/^\d+\. /)) {
                          return <li key={i} className="ml-5 my-2 list-decimal font-semibold marker:text-slate-400 marker:font-bold" dangerouslySetInnerHTML={{__html: line.replace(/^\d+\. /, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-700">$1</strong>')}} />;
                        }
                        return line.trim() ? <p key={i} className="my-3" dangerouslySetInnerHTML={{__html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}}></p> : <br key={i}/>;
                      })}
                    </div>
                 </div>
               </div>
             </div>
          )}

          {/* AI Automation States */}
          {(activeTab === 'ai_meeting' || activeTab === 'ai_action') && (
            <div className="max-w-4xl mx-auto pb-20 mt-6">
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                 <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                   {activeTab === 'ai_meeting' ? <Mic className="w-6 h-6 text-indigo-500" /> : <ListTodo className="w-6 h-6 text-indigo-500" />}
                   <h2 className="text-xl font-bold text-slate-800">
                     {activeTab === 'ai_meeting' ? t('ai.meeting.title') : t('ai.action.title')}
                   </h2>
                 </div>
                 <div className="p-8 flex-1 flex flex-col gap-6">
                   <div className="flex-1 min-h-[200px]">
                     <textarea
                       className="w-full h-full min-h-[200px] p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none outline-none transition-all placeholder:text-slate-400 text-slate-700 bg-slate-50/50"
                       placeholder={t('ai.inputPlaceholder')}
                       value={aiInputText}
                       onChange={(e) => setAiInputText(e.target.value)}
                     />
                   </div>
                   <div className="flex justify-end">
                     <button
                       onClick={() => handleAiAction(activeTab === 'ai_meeting' ? 'meeting' : 'action')}
                       disabled={isAiLoading || !aiInputText.trim()}
                       className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {isAiLoading ? (
                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                       ) : (
                         <Sparkles className="w-5 h-5" />
                       )}
                       {isAiLoading ? t('ai.analyzing') : (activeTab === 'ai_meeting' ? t('ai.summarizeBtn') : t('ai.extractBtn'))}
                     </button>
                   </div>
                   
                   {/* Render AI Result */}
                   {aiResult && aiResult.type === (activeTab === 'ai_meeting' ? 'meeting' : 'action') && (
                     <div className="mt-4 p-6 bg-indigo-50/50 border border-indigo-100 rounded-xl animate-[fadeIn_0.5s_ease-out_forwards]">
                       <h3 className="font-bold text-indigo-800 mb-4 flex items-center gap-2 pb-3 border-b border-indigo-100/50">
                         <Sparkles className="w-5 h-5 text-indigo-500" /> 
                         {activeTab === 'ai_meeting' ? t('ai.resultSummary') : t('ai.resultAction')}
                       </h3>
                       <ul className="space-y-3">
                         {(activeTab === 'ai_meeting' ? aiResult.summary : aiResult.actions).map((item: string, idx: number) => (
                           <li key={idx} className="flex gap-3 text-slate-700 font-medium leading-relaxed">
                              {activeTab === 'ai_meeting' ? (
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                              ) : (
                                <div className="w-5 h-5 rounded border-2 border-slate-300 mt-0.5 bg-white flex-shrink-0" />
                              )}
                              <span>{item}</span>
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'ai_weekly' && (
            <div className="max-w-4xl mx-auto pb-20 mt-6 animate-[fadeIn_0.5s_ease-out_forwards]">
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                 <div className="p-8 md:p-12">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-2">
                          <BarChart3 className="w-6 h-6" />
                          <span className="tracking-wider uppercase text-sm">{t('ai.weekly.reportTitle')}</span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900">{t('ai.weekly.title')}</h1>
                      </div>
                      <div className="bg-indigo-50 text-indigo-700 font-bold px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2 shadow-sm">
                        <CheckCircle2 className="w-5 h-5" />
                        {tasks.filter(t => t.status === 'Done' && isThisWeek(t.completedAt ? new Date(t.completedAt).toISOString() : new Date(t.createdAt).toISOString())).length} Tasks Done
                      </div>
                    </div>
                    
                    <div className="prose prose-slate max-w-none">
                      <p className="text-lg text-slate-600 mb-6 font-medium leading-relaxed">
                        {tasks.filter(t => t.status === 'Done' && isThisWeek(t.completedAt ? new Date(t.completedAt).toISOString() : new Date(t.createdAt).toISOString())).length > 0 ? (
                          <>🎉 {t('ai.weekly.summary1')} <strong className="text-indigo-600">{tasks.filter(t => t.status === 'Done' && isThisWeek(t.completedAt ? new Date(t.completedAt).toISOString() : new Date(t.createdAt).toISOString())).length}</strong>{t('ai.weekly.summary2')}</>
                        ) : (
                          t('ai.weekly.noTasks')
                        )}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                        {tasks.filter(t => t.status === 'Done' && isThisWeek(t.completedAt ? new Date(t.completedAt).toISOString() : new Date(t.createdAt).toISOString())).map(task => (
                           <div key={task.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                             <div className="font-semibold text-slate-800 mb-1">{task.title}</div>
                             <div className="text-sm text-slate-500 mb-2 line-clamp-2">{task.description}</div>
                             <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{task.assignee}</div>
                           </div>
                        ))}
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'ai_delay' && (
            <div className="max-w-4xl mx-auto pb-20 mt-6 animate-[fadeIn_0.5s_ease-out_forwards]">
               <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden min-h-[500px]">
                 <div className="p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                    
                    <div className="flex items-center gap-3 text-rose-600 font-semibold mb-6 not-prose relative z-10">
                      <AlertTriangle className="w-8 h-8 animate-pulse" />
                      <span className="tracking-wider text-lg">{t('ai.delay.title')}</span>
                    </div>
                    
                    <div className="bg-rose-50 border border-rose-100 p-6 rounded-xl mb-8 relative z-10">
                      <p className="text-rose-800 font-medium text-lg flex items-start gap-3">
                        <Sparkles className="w-6 h-6 mt-0.5 text-rose-500 shrink-0" />
                        {t('ai.delay.desc')}
                      </p>
                    </div>

                    <div className="space-y-4 relative z-10">
                      {tasks.filter(t => t.status !== 'Done' && new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0))).length > 0 ? (
                        tasks.filter(t => t.status !== 'Done' && new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0))).map(task => (
                          <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white border-2 border-slate-100 rounded-xl shadow-sm hover:border-rose-200 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold uppercase rounded">{t(`board.${task.status === 'Blocked' ? 'blocked' : (task.status === 'In Progress' ? 'inProgress' : 'todo')}`)}</span>
                                <h4 className="font-bold text-slate-800 text-lg">{task.title}</h4>
                              </div>
                              <p className="text-sm text-slate-500">담당자: <strong className="text-slate-700">{task.assignee}</strong></p>
                            </div>
                            <div className="bg-rose-50 px-4 py-2 rounded-lg text-center shrink-0 border border-rose-100">
                              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">마감일 (초과)</div>
                              <div className="text-rose-600 font-bold">{new Date(task.dueDate).toLocaleDateString()}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-16">
                          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium text-slate-600">{t('ai.delay.noDelays')}</p>
                        </div>
                      )}
                    </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'ai_blocker' && (
            <div className="max-w-4xl mx-auto pb-20 mt-6 animate-[fadeIn_0.5s_ease-out_forwards]">
               <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden min-h-[500px]">
                 <div className="p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <div className="flex items-center gap-3 text-orange-600 font-semibold not-prose">
                        <ShieldAlert className="w-8 h-8" />
                        <span className="tracking-wider text-lg">{t('ai.blocker.title')}</span>
                      </div>
                      <div className="bg-orange-100 text-orange-700 font-bold px-4 py-2 rounded-xl flex items-center gap-2">
                        {tasks.filter(t => t.status === 'Blocked').length} Blocked
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-100 p-6 rounded-xl mb-8 relative z-10">
                      <p className="text-orange-800 font-medium text-lg flex items-start gap-3 mb-3">
                        <Sparkles className="w-6 h-6 mt-0.5 text-orange-500 shrink-0" />
                        {t('ai.blocker.desc')}
                      </p>
                      <p className="text-slate-600 text-sm ml-9 font-medium">{t('ai.blocker.suggestion')}</p>
                    </div>

                    <div className="space-y-4 relative z-10">
                      {tasks.filter(t => t.status === 'Blocked').length > 0 ? (
                        tasks.filter(t => t.status === 'Blocked').map(task => (
                          <div key={task.id} className="p-5 bg-white border-2 border-orange-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />
                            <div className="flex justify-between items-start mb-2">
                               <h4 className="font-bold text-slate-800 text-lg">{task.title}</h4>
                               <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg shadow-sm border border-slate-200">{task.assignee}</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-4">{task.description}</p>
                            
                            <div className="bg-orange-50/50 rounded-lg p-4 border border-orange-100/50 flex items-start gap-3">
                               <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-sm border border-orange-200">
                                 <AlertCircle className="w-4 h-4" />
                               </div>
                               <div>
                                 <div className="text-[11px] font-bold text-orange-500 uppercase tracking-wider mb-1">AI Action Plan</div>
                                 <div className="text-sm text-slate-700 font-medium leading-relaxed">
                                   [{task.assignee}]님에게 일정 확인 요청 메시지를 전송하고, 즉각적인 스탠드업 미팅을 통해 문제를 공유하는 것을 권장합니다.
                                 </div>
                               </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-16">
                          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium text-slate-600">{t('ai.blocker.noBlockers')}</p>
                        </div>
                      )}
                    </div>
                 </div>
               </div>
            </div>
          )}

          {/* Coming Soon state for non-implemented paths */}
          {!['board', 'sync', 'issues', 'calendar', 'docs', 'deadline', 'comments', 'meetings', 'projects', 'risks', 'assignees', 'review_req', 'revision_req', 'pending_appr', 'completion_log', 'ai_meeting', 'ai_action', 'ai_weekly', 'ai_delay', 'ai_blocker'].includes(activeTab) && !currentManualKey && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
              <div className="w-24 h-24 mb-6 relative">
                 <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-60 duration-1000"></div>
                 <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border border-indigo-50 shadow-xl shadow-indigo-100/50 text-indigo-500">
                   <Sparkles className="w-10 h-10" />
                 </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">{t('generic.comingSoon')}</h3>
              <p className="text-[15px] font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
                <span className="text-indigo-600 font-semibold">{activeMenuLabel}</span> {t('generic.comingSoonDesc')}
              </p>
              
              <button 
                onClick={() => setActiveTab('sync')}
                className="mt-8 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl shadow-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 group"
              >
                <Home className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" /> {t('generic.goHome')}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Task Modal */}
      {isModalOpen && editingTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingTask.id ? 'Edit Task' : 'Create New Task'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="task-form" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                saveTask({
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  assignee: formData.get('assignee') as string,
                  dueDate: formData.get('dueDate') as string,
                  priority: formData.get('priority') as Priority,
                  status: formData.get('status') as Status,
                });
              }} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input 
                    name="title" 
                    defaultValue={editingTask.title} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="E.g., Update landing page copy"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    defaultValue={editingTask.description} 
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                    placeholder="Add details, acceptance criteria, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                    <input 
                      name="assignee" 
                      defaultValue={editingTask.assignee} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Team member name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                    <input 
                      type="date"
                      name="dueDate" 
                      defaultValue={editingTask.dueDate} 
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                    <select 
                      name="priority" 
                      defaultValue={editingTask.priority}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select 
                      name="status" 
                      defaultValue={editingTask.status}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                    >
                      {COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Feedback Center Action Area */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                   <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                     <Eye className="w-4 h-4 text-indigo-500" /> 피드백 요건 변경
                   </h4>
                   <div className="flex flex-wrap gap-2">
                     {editingTask.status !== 'Done' && (
                       <>
                         <button type="button" onClick={() => updateFeedbackStatus(editingTask.id, 'request_review')} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${editingTask.feedbackStatus === 'request_review' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                           {t('feedback.reqReviewBtn')}
                         </button>
                         <button type="button" onClick={() => updateFeedbackStatus(editingTask.id, 'request_revision')} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${editingTask.feedbackStatus === 'request_revision' ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                           {t('feedback.reqRevisionBtn')}
                         </button>
                         <button type="button" onClick={() => updateFeedbackStatus(editingTask.id, 'pending_approval')} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${editingTask.feedbackStatus === 'pending_approval' ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                           {t('feedback.reqApprBtn')}
                         </button>
                       </>
                     )}
                     <button type="button" onClick={() => updateFeedbackStatus(editingTask.id, 'approved', 'Done')} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${editingTask.feedbackStatus === 'approved' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`}>
                       <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> {t('feedback.approveBtn')}
                     </button>
                   </div>
                   {editingTask.feedbackStatus && (
                     <p className="mt-2 text-[11px] text-slate-500 font-medium">현재 상태: <span className="text-indigo-600">{t(`feedback.status.${editingTask.feedbackStatus}`)}</span></p>
                   )}
                </div>

              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              {editingTask.id ? (
                <button 
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this task?')) {
                      handleDeleteTask(editingTask.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Delete Task
                </button>
              ) : <div></div>}
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="task-form"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  {editingTask.id ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  key?: string | number;
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}

function TaskCard({ task, onDragStart, onClick }: TaskCardProps) {
  const priorityColors = {
    High: 'bg-orange-100 text-orange-700 border-orange-200',
    Medium: 'bg-blue-100 text-blue-700 border-blue-200',
    Low: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <button className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 transition-opacity">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <h4 className="font-medium text-slate-800 mb-1 leading-tight">{task.title}</h4>
      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
            {task.assignee ? task.assignee.charAt(0).toUpperCase() : '?'}
          </div>
          <span className="truncate max-w-[80px]">{task.assignee || 'Unassigned'}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Calendar className="w-3 h-3" />
          {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
