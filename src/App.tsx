import React, { useState, useEffect } from 'react';
import { Task, Status, Priority } from './types';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
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
  Sparkles
} from 'lucide-react';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

  // Calendar State
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  // Firestore Tasks Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const unsubscribe = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(newTasks);
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    
    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Calendar Events Fetcher
  useEffect(() => {
    if (isCalendarConnected && googleAccessToken) {
      fetchCalendarEvents(currentMonth);
    }
  }, [currentMonth, isCalendarConnected, googleAccessToken]);

  const menuCategories = [
    {
      title: "회사 홈",
      items: [
        { id: 'sync', label: '오늘 할 일', icon: <Clock className="w-[18px] h-[18px]" /> },
        { id: 'deadline', label: '이번 주 마감', icon: <CalendarClock className="w-[18px] h-[18px]" /> },
        { id: 'issues', label: '긴급 이슈', icon: <AlertOctagon className="w-[18px] h-[18px]" />, badge: tasks.filter(t => t.status === 'Blocked').length },
        { id: 'comments', label: '팀 코멘트', icon: <MessageSquare className="w-[18px] h-[18px]" /> },
        { id: 'meetings', label: '회의 일정', icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'docs', label: '문서 바로가기', icon: <FileText className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: "프로젝트 센터",
      items: [
        { id: 'projects', label: '프로젝트 목록', icon: <Folder className="w-[18px] h-[18px]" /> },
        { id: 'board', label: '상태 보드', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
        { id: 'calendar', label: '일정 캘린더', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
        { id: 'risks', label: '리스크 보드', icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
        { id: 'assignees', label: '담당자별 보기', icon: <Users className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: "피드백 센터",
      items: [
        { id: 'review_req', label: '작업 리뷰 요청', icon: <Eye className="w-[18px] h-[18px]" /> },
        { id: 'revision_req', label: '수정 요청', icon: <Edit3 className="w-[18px] h-[18px]" /> },
        { id: 'pending_appr', label: '승인 대기', icon: <Clock className="w-[18px] h-[18px]" /> },
        { id: 'completion_log', label: '완료 로그', icon: <CheckCircle2 className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: "운영 메뉴얼",
      items: [
        { id: 'routine', label: '업무 시작/종료 루틴', icon: <Power className="w-[18px] h-[18px]" /> },
        { id: 'req_rules', label: '작업 요청 규칙', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
        { id: 'meet_rules', label: '회의 진행 규칙', icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'file_rules', label: '파일 관리 규칙', icon: <FileArchive className="w-[18px] h-[18px]" /> },
        { id: 'deploy_check', label: '배포/제출 체크리스트', icon: <Send className="w-[18px] h-[18px]" /> },
      ]
    },
    {
      title: "AI 자동화",
      items: [
        { id: 'ai_meeting', label: '회의록 요약', icon: <Mic className="w-[18px] h-[18px]" /> },
        { id: 'ai_action', label: '액션아이템 추출', icon: <ListTodo className="w-[18px] h-[18px]" /> },
        { id: 'ai_weekly', label: '주간 업무 요약', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
        { id: 'ai_delay', label: '일정 지연 경고', icon: <AlertTriangle className="w-[18px] h-[18px]" /> },
        { id: 'ai_blocker', label: '막힌 이슈 알림', icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
      ]
    }
  ];

  const activeMenu = menuCategories.flatMap(c => c.items).find(i => i.id === activeTab);
  const activeMenuLabel = activeMenu?.label || 'Dashboard';

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
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
                      onClick={() => setActiveTab(item.id)}
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
        
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3 px-2 hover:bg-slate-50 p-2 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-9 h-9 rounded-full ring-2 ring-white shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{user.displayName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate leading-tight">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors" title="Sign Out">
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
              New Task
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
                  Today's Focus
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <h4 className="font-medium text-emerald-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Done Yesterday
                    </h4>
                    <ul className="space-y-2">
                      {tasks.filter(t => t.status === 'Done').slice(0, 5).map(t => (
                        <li key={t.id} className="text-sm text-emerald-700 bg-white px-3 py-2 rounded shadow-sm border border-emerald-100">
                          <span className="font-medium">{t.assignee}:</span> {t.title}
                        </li>
                      ))}
                      {tasks.filter(t => t.status === 'Done').length === 0 && (
                        <li className="text-sm text-emerald-600/70 italic">No tasks completed recently.</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Doing Today
                    </h4>
                    <ul className="space-y-2">
                      {tasks.filter(t => t.status === 'In Progress').map(t => (
                        <li key={t.id} className="text-sm text-blue-700 bg-white px-3 py-2 rounded shadow-sm border border-blue-100">
                          <span className="font-medium">{t.assignee}:</span> {t.title}
                        </li>
                      ))}
                      {tasks.filter(t => t.status === 'In Progress').length === 0 && (
                        <li className="text-sm text-blue-600/70 italic">No tasks currently in progress.</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4" /> Blockers
                    </h4>
                    <ul className="space-y-2">
                      {tasks.filter(t => t.status === 'Blocked').map(t => (
                        <li key={t.id} className="text-sm text-red-700 bg-white px-3 py-2 rounded shadow-sm border border-red-100">
                          <span className="font-medium">{t.assignee}:</span> {t.title}
                        </li>
                      ))}
                      {tasks.filter(t => t.status === 'Blocked').length === 0 && (
                        <li className="text-sm text-red-600/70 italic">No current blockers. Great job!</li>
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

          {/* Coming Soon state for non-implemented paths */}
          {!['board', 'sync', 'issues', 'calendar'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
              <div className="w-24 h-24 mb-6 relative">
                 <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-60 duration-1000"></div>
                 <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border border-indigo-50 shadow-xl shadow-indigo-100/50 text-indigo-500">
                   <Sparkles className="w-10 h-10" />
                 </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">서비스 준비 중입니다</h3>
              <p className="text-[15px] font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
                <span className="text-indigo-600 font-semibold">{activeMenuLabel}</span> 기능은 현재 고도화 개발 중입니다.<br/>빠른 시일 내에 멋진 모습으로 찾아뵙겠습니다!
              </p>
              
              <button 
                onClick={() => setActiveTab('sync')}
                className="mt-8 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl shadow-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 group"
              >
                <Home className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" /> 홈으로 돌아가기
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

function TaskCard({ task, onDragStart, onClick }: { task: Task, onDragStart: (e: React.DragEvent, id: string) => void, onClick: () => void }) {
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
