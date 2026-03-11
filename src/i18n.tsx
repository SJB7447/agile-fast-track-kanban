import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ko' | 'en';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

export const translations: Translations = {
  ko: {
    // Sidebar Main Categories
    'nav.companyHome': '회사 홈',
    'nav.projectCenter': '프로젝트 센터',
    'nav.feedbackCenter': '피드백 센터',
    'nav.manual': '운영 메뉴얼',
    'nav.aiAutomation': 'AI 자동화',
    
    // Sidebar Items
    'nav.item.today': '오늘 할 일',
    'nav.item.deadline': '이번 주 마감',
    'nav.item.issues': '긴급 이슈',
    'nav.item.comments': '팀 코멘트',
    'nav.item.meetings': '회의 일정',
    'nav.item.docs': '문서 바로가기',
    'nav.item.projects': '프로젝트 목록',
    'nav.item.board': '상태 보드',
    'nav.item.calendar': '일정 캘린더',
    'nav.item.risks': '리스크 보드',
    'nav.item.assignees': '담당자별 보기',
    'nav.item.reviewRequest': '작업 리뷰 요청',
    'nav.item.editRequest': '수정 요청',
    'nav.item.pendingApproval': '승인 대기',
    'nav.item.completedLogs': '완료 로그',
    'nav.item.workRoutine': '업무 시작/종료 루틴',
    'nav.item.requestRules': '작업 요청 규칙',
    'nav.item.meetingRules': '회의 진행 규칙',
    'nav.item.fileRules': '파일 관리 규칙',
    'nav.item.deployChecklist': '배포/제출 체크리스트',
    'nav.item.summaryMeetings': '회의록 요약',
    'nav.item.extractActions': '액션아이템 추출',
    'nav.item.weeklySummary': '주간 업무 요약',
    'nav.item.delayWarning': '일정 지연 경고',
    'nav.item.blockedAlert': '막힌 이슈 알림',
    
    // Auth & Generic
    'app.title': 'Fast-Track Agile',
    'app.tagline': '팀의 칸반 보드에 접속하고 구글 캘린더와 동기화하세요.',
    'auth.signInGoogle': 'Google로 로그인',
    'auth.logout': '로그아웃',
    'generic.loading': '메뉴 로딩 중...',
    'generic.comingSoon': '서비스 준비 중입니다',
    'generic.comingSoonDesc': '기능은 현재 고도화 개발 중입니다. 빠른 시일 내에 멋진 모습으로 찾아뵙겠습니다!',
    'generic.goHome': '홈으로 돌아가기',
    
    // Board
    'board.newTask': '새 작업 추가',
    'board.searchPlaceholder': '작업 검색...',
    'board.priority.high': '높음',
    'board.priority.medium': '중간',
    'board.priority.low': '낮음',
    'board.todo': '해야 할 일',
    'board.inProgress': '진행 중',
    'board.blocked': '이슈',
    'board.done': '완료',

    // Issues
    'issues.title': '긴급 이슈 현황',
    'issues.subtitle': 'Blocked 상태이거나 마감일이 지난 High 우선순위 태스크',
    'issues.noIssues': '현재 진행을 막고 있는 긴급 이슈가 없습니다.',
    'issues.goodJob': '팀이 계획대로 잘 움직이고 있습니다!',

    // Sync (Home)
    'home.welcome': '환영합니다,',
    'home.todaySummary': '님의 오늘 업무 요약',
    'home.connectCalendar': '일정 동기화를 위해 Google 캘린더를 연결해주세요.',
    'home.connectBtn': 'Google 캘린더 연결',
    'home.connected': '일정이 동기화되었습니다.',
    'home.todayTasks': '오늘 집중할 작업',
    'home.noTasks': '오늘 계획된 작업이 없습니다.',
    'home.addFirstTask': '첫 번째 작업을 등록해보세요.',
    'home.upcomingTasks': '다가오는 마감',
    'home.noUpcoming': '이번 주에 마감되는 작업이 없습니다.',
    'home.myProgress': '나의 진행 상황',
    'home.progressDesc': '전체 작업의',
    'home.eventsToday': '오늘의 회의/일정',
    'home.noEvents': '오늘 예정된 일정이 없습니다.',

    // Calendar
    'calendar.title': '일정 캘린더',
    'calendar.today': '오늘',
    
    // Docs (Drive)
    'docs.connect': 'Google Drive 연결',
    'docs.connectDesc': 'Google Drive에 파일을 저장하고 팀과 공유하세요. 로그인 시 Drive 접근 권한이 필요합니다.',
    'docs.connectBtn': 'Drive 연결하기',
    'docs.uploadArea': '파일을 드래그하거나 클릭하여 업로드',
    'docs.uploading': '업로드 중...',
    'docs.saveLoc': 'Google Drive "Fast-Track Agile" 폴더에 저장됩니다',
    'docs.fileList': '파일 목록',
    'docs.refresh': '새로고침',
    'docs.noFiles': '아직 업로드된 파일이 없습니다',
    'docs.tryUpload': '위 영역을 클릭하여 파일을 업로드해 보세요'
  },
  en: {
    // Sidebar Main Categories
    'nav.companyHome': 'Company Home',
    'nav.projectCenter': 'Project Center',
    'nav.feedbackCenter': 'Feedback Center',
    'nav.manual': 'Operation Manual',
    'nav.aiAutomation': 'AI Automation',
    
    // Sidebar Items
    'nav.item.today': 'Today\'s Tasks',
    'nav.item.deadline': 'Due This Week',
    'nav.item.issues': 'Urgent Issues',
    'nav.item.comments': 'Team Comments',
    'nav.item.meetings': 'Meeting Schedule',
    'nav.item.docs': 'Documents',
    'nav.item.projects': 'Project List',
    'nav.item.board': 'Status Board',
    'nav.item.calendar': 'Calendar',
    'nav.item.risks': 'Risk Board',
    'nav.item.assignees': 'By Assignee',
    'nav.item.reviewRequest': 'Review Requests',
    'nav.item.editRequest': 'Edit Requests',
    'nav.item.pendingApproval': 'Pending Approval',
    'nav.item.completedLogs': 'Completed Logs',
    'nav.item.workRoutine': 'Work Routines',
    'nav.item.requestRules': 'Request Rules',
    'nav.item.meetingRules': 'Meeting Rules',
    'nav.item.fileRules': 'File Guidelines',
    'nav.item.deployChecklist': 'Deploy Checklist',
    'nav.item.summaryMeetings': 'Meeting Summaries',
    'nav.item.extractActions': 'Action Items',
    'nav.item.weeklySummary': 'Weekly Summaries',
    'nav.item.delayWarning': 'Delay Warnings',
    'nav.item.blockedAlert': 'Blocked Alerts',

    // Auth & Generic
    'app.title': 'Fast-Track Agile',
    'app.tagline': 'Access your team\'s Kanban board and sync your Google Calendar.',
    'auth.signInGoogle': 'Sign in with Google',
    'auth.logout': 'Logout',
    'generic.loading': 'Loading menus...',
    'generic.comingSoon': 'Service under construction',
    'generic.comingSoonDesc': 'This feature is currently under active development. We will be back soon with a great new look!',
    'generic.goHome': 'Return Home',

    // Board
    'board.newTask': 'New Task',
    'board.searchPlaceholder': 'Search tasks...',
    'board.priority.high': 'High',
    'board.priority.medium': 'Medium',
    'board.priority.low': 'Low',
    'board.todo': 'To Do',
    'board.inProgress': 'In Progress',
    'board.blocked': 'Blocked',
    'board.done': 'Done',

    // Issues
    'issues.title': 'Urgent Issue Status',
    'issues.subtitle': 'Tasks that are Blocked or overdue High priority',
    'issues.noIssues': 'No urgent issues blocking progress currently.',
    'issues.goodJob': 'The team is moving along as planned!',

    // Sync (Home)
    'home.welcome': 'Welcome,',
    'home.todaySummary': '\'s Today Summary',
    'home.connectCalendar': 'Please connect your Google Calendar to sync events.',
    'home.connectBtn': 'Connect Google Calendar',
    'home.connected': 'Calendar synced successfully.',
    'home.todayTasks': 'Focus for Today',
    'home.noTasks': 'No tasks scheduled for today.',
    'home.addFirstTask': 'Try adding your first task.',
    'home.upcomingTasks': 'Upcoming Deadlines',
    'home.noUpcoming': 'No tasks due this week.',
    'home.myProgress': 'My Progress',
    'home.progressDesc': 'of all tasks completed',
    'home.eventsToday': 'Today\'s Schedule',
    'home.noEvents': 'No events scheduled for today.',

    // Calendar
    'calendar.title': 'Schedule Calendar',
    'calendar.today': 'Today',

    // Docs (Drive)
    'docs.connect': 'Connect Google Drive',
    'docs.connectDesc': 'Store files in Google Drive and share them with your team. Requires Drive access permissions on login.',
    'docs.connectBtn': 'Connect Drive',
    'docs.uploadArea': 'Drag and drop files or click to upload',
    'docs.uploading': 'Uploading...',
    'docs.saveLoc': 'Saved to Google Drive "Fast-Track Agile" folder',
    'docs.fileList': 'File List',
    'docs.refresh': 'Refresh',
    'docs.noFiles': 'No files uploaded yet',
    'docs.tryUpload': 'Click the area above to upload a file'
  }
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('appLanguage');
    if (saved === 'ko' || saved === 'en') return saved;
    return navigator.language.startsWith('ko') ? 'ko' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
