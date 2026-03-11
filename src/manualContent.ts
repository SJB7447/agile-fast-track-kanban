export type Language = 'ko' | 'en';

export const manualContent: Record<Language, Record<string, { title: string; content: string }>> = {
  ko: {
    routine: {
      title: '일일 업무 시작/종료 루틴',
      content: `## 🌅 업무 시작 루틴 (아침)
1. **어제 완료한 작업 리뷰**: 퇴근 전 'In Progress'나 'Blocked'였던 작업 상태 점검
2. **오늘 할 일(To Do) 배정**: 데일리 미팅 전, 칸반 상의 'To Do' 컬럼에서 본인의 당일 목표 작업 카드 2~3개 선별
3. **긴급 이슈 모니터링**: '긴급 이슈' 메뉴 혹은 Slack 채널을 통해 Blocked 상태의 태스크와 팀원 지원 요청 확인
4. **캘린더 점검**: '회의 일정' 탭에서 오늘의 주요 미팅 시간 및 회의록 담당자 확인

## 🌇 업무 종료 루틴 (저녁)
1. **작업 상태 현행화**: 완료한 태스크는 'Done'으로, 내일 이어서 할 작업은 'In Progress'로 명확히 이동
2. **이슈 리포팅**: 작업 중 막힌 부분이나 의존성 문제가 있다면 카드를 'Blocked' 컬럼으로 옮기고, 상황을 상세히 코멘트에 기재
3. **작업 브랜치/코드 커밋**: 매일 퇴근 전 로컬 저장소의 진행 상황을 원격 저장소에 PUSH하여 코드 유실 방지 및 진행 상황 공유
4. **내일의 핵심 과제(Top Priority) 1가지 설정**: 다음 업무를 시작할 때 즉시 집중할 수 있도록 사전 구성`
    },
    req_rules: {
      title: '작업 및 이슈 요청 규칙',
      content: `## 🏷️ 태스크 생성 및 라벨링 규칙
- **제목(Title)**: [작업유형] 대상 시스템 - 핵심 내용 (예: [FE] 로그인 모달 - 구글 간편 연동 버튼 추가)
- **설명(Description)**:
  - **As-Is (현재 상태)**: 현재 어떤 문제가 있거나 부족한지
  - **To-Be (기대 결과)**: 이 작업이 완료되었을 때 예상되는 결과
  - **Acceptance Criteria (완료 조건)**: 어떤 조건을 충족해야 'Done'으로 간주할 것인지 명확히 기재
- **우선순위(Priority)**:
  - **High**: 팀 병목 방지 또는 크리티컬 버그 수정 (우선 처리)
  - **Medium**: 일반적인 피처 개발 수준
  - **Low**: 단순 리팩토링이나 당장 급하지 않은 디자인 다듬기

## 🤝 크로스펑셔널(Cross-Functional) 작업 요청
- 타 부서(디자인, 백엔드 등)에 작업을 요청할 경우, 태스크 생성 후 해당 인원에게 Slack 스레드 링크와 칸반 카드 링크를 반드시 전달합니다.
- 긴급도가 'High'인 건은 데일리 스크럼(Daily Scrum) 시간에 한 번 더 구두로 강조합니다.`
    },
    meet_rules: {
      title: '효율적인 회의 진행 규칙',
      content: `## 🕒 회의 준비 가이드라인
- **회의 목적 명확화**: 회의 초대장(Google Calendar)의 발송자는 목적(공유, 의견 수렴, 의사결정)과 기대하는 아웃풋을 반드시 기재합니다.
- **사전 자료 공유**: 회의 시작 최소 2시간 전, 회의에서 논의할 주요 어젠다 및 참고 자료(Google Drive 링크 등)를 공유해야 합니다.
- **회의 시간제한**: 기본 회의 시간은 **30분**으로 설정하며, 브레인스토밍 등 불가피한 경우에 한하여 1시간으로 설정합니다. 시간은 엄수합니다.

## 🗣️ 회의 진행 및 후속 조치
- **타임키퍼(Timekeeper) 지정**: 어젠다가 길어질 경우 논의 시간을 관리할 타임키퍼를 정합니다. 필요 없는 논의로 빠질 땐 **"주차장(Parking Lot)으로 빼두자"**라고 제안합니다.
- **액션아이템 추출**: 회의 마지막 5분은 반드시 도출된 액션아이템(Action Item)을 정리하고 **담당자(Assignee)**와 **마감일(Due Date)**을 명확히 합니다.
- **칸반 연동**: 정리된 액션아이템은 즉각 'To Do' 컬럼의 새 카드(Task)로 생성되어야 합니다.`
    },
    file_rules: {
      title: 'Google Drive 문서/파일 관리 규칙',
      content: `## 📁 폴더 및 식별 체계 가이드
- **최상위 디렉터리 구성**:
  1. \`01_Product_Docs\`: 기획서, PRD, 정책서
  2. \`02_Design_Assets\`: 디자인 원본, UI 가이드, 에셋
  3. \`03_Tech_Specs\`: API 명세서, 아키텍처 다이어그램, 기술 리뷰 문서
  4. \`04_Meetings\`: 회의록 및 주간 리포트

## 📝 파일 네이밍(Naming) 컨벤션
- 기본 구조: \`[날짜]_[문서종류]_[핵심주제]_[버전/작성자]\`
- 예시:
  - \`260311_회의록_위클리_스프린트_플래닝.docx\`
  - \`260501_PRD_관리자_권한_시스템_v1.2.pdf\`
- 소수점 버저닝 규칙:
  - Draft (초안): v0.1, v0.2...
  - Review (리뷰 중): v0.9
  - Final (최종 배포): v1.0, v2.0...

## 🔄 문서 소유권 및 권한 관리
- 회사 공용 문서(특히 정책서/가이드라인)의 생성자는 반드시 편집 권한을 팀의 리더/코어 멤버에게 위임하거나 공유 드라이브를 통해 생성해야 합니다.`
    },
    deploy_check: {
      title: '배포 및 제출 전 필수 체크리스트',
      content: `## ✅ QA/테스트 필수 점검 항목
- [ ] **동작 테스트**: 요구사항 정의서(Acceptance Criteria)에 명시된 기능이 100% 정상 작동하는가?
- [ ] **반응형 체크**: 데스크탑, 태블릿, 모바일 최소 해상도 화면에서 UI/UX가 깨지지 않는가?
- [ ] **크로스 브라우징**: Chrome, Safari, Edge 환경에서 문제없이 렌더링되는가?
- [ ] **예외 처리**: 데이터를 받아오지 못하는 에러 시나리오나 로딩 지연 상태에 대한 처리가 포함되었는가?

## 🚀 배포 직전 확인 사항
- [ ] **환경 변수**: Vercel/서버의 환경 변수(Environment Variables) 세팅이 누락되지 않았는가?
- [ ] **코드 클리닝**: \`console.log\`, 임시 주석, 사용하지 않는 import 등 불필요한 코드가 제거되었는가?
- [ ] **피드백 센터(리뷰/승인)**: 배포 전, 피드백 센터의 '작업 리뷰 요청' 이나 '승인 대기' 단계를 정상적으로 통과하여 승인(Approved)을 받았는가?
- [ ] 해당 태스크 카드의 상태를 **'Done'**으로 변경하였는가?`
    }
  },
  en: {
    routine: {
      title: 'Daily Work Routine (Start/End)',
      content: `## 🌅 Start Routine (Morning)
1. **Review Completed Work**: Check the status of tasks that were 'In Progress' or 'Blocked' before leaving yesterday.
2. **Assign Today's Tasks (To Do)**: Before the daily meeting, pick 2-3 target tasks for the day from the 'To Do' column on the Kanban board.
3. **Monitor Urgent Issues**: Check tasks in the 'Blocked' status and team support requests through the 'Urgent Issues' menu or Slack.
4. **Calendar Check**: Check today's major meeting times and the minute-taker in the 'Meeting Schedule' tab.

## 🌇 End Routine (Evening)
1. **Update Task Status**: Move completed tasks to 'Done' and tasks to be continued tomorrow to 'In Progress' clearly.
2. **Issue Reporting**: If there are blockages or dependency issues, move the card to the 'Blocked' column and describe the situation in detail in the comments.
3. **Commit Branch/Code**: Before leaving every day, PUSH the progress of the local repository to the remote repository to prevent code loss and share progress.
4. **Set Tomorrow's Top Priority (1)**: Formulate in advance so you can immediately focus when you start your next work.`
    },
    req_rules: {
      title: 'Task and Issue Request Rules',
      content: `## 🏷️ Task Creation and Labeling Rules
- **Title**: [Task Type] Target System - Core Content (e.g., [FE] Login Modal - Add Google Quick Link Button)
- **Description**:
  - **As-Is (Current State)**: What is currently problematic or lacking
  - **To-Be (Expected Result)**: Expected results when this task is completed
  - **Acceptance Criteria**: Clearly state what conditions must be met to be considered 'Done'
- **Priority**:
  - **High**: Prevent team bottlenecks or critical bug fixes (priority handling)
  - **Medium**: General feature development level
  - **Low**: Simple refactoring or design polishing that is not urgent right away

## 🤝 Cross-Functional Task Requests
- When requesting work from other departments (design, backend, etc.), be sure to deliver the Slack thread link and Kanban card link to the personnel after creating the task.
- Issues with 'High' urgency are verbally emphasized one more time during Daily Scrum time.`
    },
    meet_rules: {
      title: 'Effective Meeting Rules',
      content: `## 🕒 Meeting Preparation Guidelines
- **Clarify the Purpose**: The sender of the meeting invitation (Google Calendar) must state the purpose (sharing, gathering opinions, decision-making) and expected output.
- **Share Preliminary Materials**: At least 2 hours before the start of the meeting, major agendas and reference materials (Google Drive links, etc.) to be discussed at the meeting must be shared.
- **Meeting Time Limit**: The basic meeting time is set to **30 minutes**, and is set to 1 hour only in unavoidable cases such as brainstorming. Time is strictly kept.

## 🗣️ Meeting Progression and Follow-up
- **Designate Timekeeper**: If the agenda becomes long, designate a timekeeper to manage the discussion time. Suggest **"Let's put it in the parking lot"** when falling into unnecessary discussions.
- **Extract Action Items**: In the last 5 minutes of the meeting, clearly organize the action items derived and clarify the **Assignee** and **Due Date**.
- **Kanban Linkage**: Organized action items must immediately be created as new cards (Tasks) in the 'To Do' column.`
    },
    file_rules: {
      title: 'Google Drive File Management Rules',
      content: `## 📁 Folder and Identification System Guide
- **Top-Level Directory Composition**:
  1. \`01_Product_Docs\`: Scenarios, PRD, Policy Documents
  2. \`02_Design_Assets\`: Original Designs, UI Guides, Assets
  3. \`03_Tech_Specs\`: API specs, Architecture Diagrams, Tech Review Docs
  4. \`04_Meetings\`: Meeting Minutes and Weekly Reports

## 📝 File Naming Convention
- Basic Structure: \`[Date]_[DocType]_[CoreTopic]_[Version/Author]\`
- Examples:
  - \`260311_Minutes_Weekly_Sprint_Planning.docx\`
  - \`260501_PRD_Admin_Auth_System_v1.2.pdf\`
- Decimal Versioning Rules:
  - Draft: v0.1, v0.2...
  - Review in Progress: v0.9
  - Final Deploy: v1.0, v2.0...

## 🔄 Document Ownership and Permission Management
- The creator of company public documents (especially policy documents/guidelines) must delegate editing authority to the team leader/core members or create them through a shared drive.`
    },
    deploy_check: {
      title: 'Pre-Deployment / Pre-Submission Checklist',
      content: `## ✅ QA/Testing Mandatory Check Items
- [ ] **Behavior Test**: Do the features specified in the Acceptance Criteria work 100% normally?
- [ ] **Responsive Check**: Does the UI/UX not break at the minimum resolution of desktop, tablet, and mobile screens?
- [ ] **Cross-Browsing**: Does it render without problems in Chrome, Safari, and Edge environments?
- [ ] **Exception Handling**: Are error scenarios where data cannot be retrieved or process loading delay states included?

## 🚀 Items to Check Immediately Before Deployment
- [ ] **Environment Variables**: Are Vercel/Server Environment Variables (ENV) settings missing?
- [ ] **Code Cleaning**: Have unnecessary codes such as \`console.log\`, temporary comments, and unused imports been removed?
- [ ] **Feedback Center (Review/Approval)**: Before deployment, did it normally pass the 'Work Review Request' or 'Pending Approval' stages of the Feedback Center and receive 'Approved'?
- [ ] Did you change the status of the corresponding task card to **'Done'**?`
    }
  }
};
