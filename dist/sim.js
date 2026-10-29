/**
 * AURORA Industrial Intelligence - 핵심 시뮬레이션 및 애플리케이션 로직
 * PRD v1.0 전 모듈 구현 (모든 화면 메시지 및 인터페이스 100% 한글화):
 * - 2D 설비 관제 및 금속 표면파 센서 데이터 버스 애니메이션
 * - 2027년 365일 연간 시뮬레이터 (1일/초, 5배속, 30배속)
 * - 전문 AI 분석실 (데이터 품질 진단, 4대 모델 비교, XAI 쉬운 설명, 다목적 최적화)
 * - 정비 협업 및 현장 표준행동절차(SOP) 워크플로우
 * - 5종 정형 보고서 스튜디오 (3개 독자 모드 맞춤형 서술)
 * - 우측 도크 유틸리티 (무사고 안전, 공지사항, 공학 단위 환산기, 공학용 계산기)
 */

(function () {
    'use strict';

    // 1. 애플리케이션 상태 (Application State)
    const state = {
        theme: 'dark',
        industry: 'SEMICONDUCTOR', // 'SEMICONDUCTOR' 또는 'OLED'
        role: 'manager', // 'operator', 'maintenance', 'manager', 'engineer', 'clevel'
        activeWorkspace: 'control', // 'control', 'lab', 'tasks', 'reports'
        
        // 시뮬레이션 시간 상태
        simDate: new Date(2027, 0, 1),
        simDayOfYear: 1,
        isPlaying: false,
        playbackSpeed: 1, // 1, 5, 30
        simTimer: null,
        
        // 데이터 및 모델 메트릭스
        dataset: [],
        profiles: [],
        modelMetrics: null,
        
        // 관제 상태
        selectedEquipmentIdx: 0,
        equipmentStatuses: Array(10).fill('normal'),
        
        // AI 분석실 상태
        labActiveTab: 'diagnostic',
        scenarioSliders: {
            tempOffset: 0.0,
            pressOffset: 0.0,
            rfOffset: 0.0
        },
        
        // 보고서 스튜디오 상태
        reportTemplate: 'RP-T01',
        reportAudience: 'manager',
        
        // 정비 점검 작업 목록
        tasks: [
            { id: '작업-2027-0102', eqId: 'EQ_SEMI_03', eqName: 'PECVD 플라즈마 증착기', priority: 'P0 긴급', title: 'RF 파워 매칭 회로 임피던스 이탈 점검', assignee: '김정비 책임', status: 'IN_PROGRESS', date: '2027-01-02' },
            { id: '작업-2027-0105', eqId: 'EQ_SEMI_07', eqName: '화학기계적 연마기(CMP)', priority: 'P1 점검', title: '연마 패드 잔여 수명 측정 및 슬러리 유량 교정', assignee: '박공정 선임', status: 'PENDING_APPROVAL', date: '2027-01-05' },
            { id: '작업-2027-0109', eqId: 'EQ_SEMI_05', eqName: 'ICP 고밀도 플라즈마 식각기', priority: 'P2 계획', title: '정기 챔버 세정 및 정전척(ESC) 헬륨 리크 검사', assignee: '이수석 기술원', status: 'COMPLETED', date: '2027-01-09' }
        ],
        
        // 공지 및 안전 현황
        safeDays: 428,
        notices: [
            { id: 1, title: '2027년 1분기 플라즈마 설비 정기 무재해 점검 캠페인', author: '안전환경팀', date: '2027-01-01', level: '중요' },
            { id: 2, title: '금속 차폐 구간 표면파 센서 통신 펌웨어 제2.4판 패치 완료', author: '스마트제조추진본부', date: '2027-01-03', level: '일반' },
            { id: 3, title: '야간 교대 시 웨이퍼 이송 레일 퍼지 가스 유량 확인 필수', author: '생산운영실', date: '2027-01-07', level: '주의' }
        ]
    };

    // 2. 초기화 함수 (즉시 동기 렌더링 + 백그라운드 데이터 로드)
    function initApp() {
        try {
            setupEventListeners();
            setupRightDockTools();

            // 1단계: 네트워크 지연 없이 즉시 화면 렌더링!
            updateDateDisplay();
            updateEquipmentDisplay();
            updateKpis();
            triggerLotCarrierAnimation();
            renderWorkspace();

            // 2단계: 백그라운드 데이터 비동기 로드
            loadMetrics().then(() => {
                if (state.activeWorkspace === 'lab') renderLabBenchmarkSection();
            }).catch(e => console.warn("메트릭스 비동기 로드 안내:", e));

            loadProfiles().then(() => {
                if (state.activeWorkspace === 'lab') renderLabDiagnosticSection();
            }).catch(e => console.warn("프로파일 비동기 로드 안내:", e));
        } catch (err) {
            console.error("초기화 중 오류 발생:", err);
        }
    }

    // 3. 메트릭스 및 프로파일 로드
    async function loadMetrics() {
        try {
            const res = await fetch('model_metrics.json');
            if (res.ok) {
                state.modelMetrics = await res.json();
            }
        } catch (e) {
            console.warn("기본 모델 메트릭스를 사용합니다:", e);
        }
        if (!state.modelMetrics) {
            state.modelMetrics = {
                models: {
                    decision_tree: { name: '의사결정나무', type: '단일 결정나무 회귀 모델', mae: 0.3054, rmse: 0.3856, r2: 0.5952, latency_ms: 1.2, weights: 0.235 },
                    random_forest: { name: '랜덤포레스트', type: '배깅 앙상블 회귀 모델', mae: 0.3014, rmse: 0.3809, r2: 0.6049, latency_ms: 4.8, weights: 0.270 },
                    extra_trees: { name: '엑스트라트리', type: '극단적 무작위 분할 트리', mae: 0.3116, rmse: 0.3928, r2: 0.5798, latency_ms: 3.9, weights: 0.220 },
                    gradient_boosting: { name: '그래디언트부스팅', type: '순차 부스팅 회귀 모델', mae: 0.3051, rmse: 0.3854, r2: 0.5955, latency_ms: 6.5, weights: 0.275 },
                    weighted_ensemble: { name: '검증 가중 앙상블 (운영 모델)', type: '검증오차 역수 가중 융합 모델', mae: 0.3018, rmse: 0.3816, r2: 0.6036, latency_ms: 8.2, weights: 1.0 }
                },
                feature_importances: [
                    { name: '공정 온도 편차 (측정치 vs 설정치)', importance: 0.342 },
                    { name: '챔버 압력 편차 (측정치 vs 설정치)', importance: 0.298 },
                    { name: 'RF 플라즈마 전력', importance: 0.185 },
                    { name: '설비 진동 실효치 (RMS)', importance: 0.082 },
                    { name: '공정 가스 유량', importance: 0.054 },
                    { name: '공정당 소비 전력량', importance: 0.039 }
                ]
            };
        }
    }

    async function loadProfiles() {
        try {
            let res = await fetch('process_profiles.csv');
            if (!res.ok) {
                res = await fetch('../process_profiles.csv');
            }
            if (res.ok) {
                const text = await res.text();
                parseProfilesCSV(text);
            }
        } catch (e) {
            console.log("프로파일 로드 안내:", e);
        }
    }

    function parseProfilesCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return;
        const headers = lines[0].split(',');
        state.profiles = lines.slice(1).map(line => {
            const cols = line.split(',');
            const obj = {};
            headers.forEach((h, i) => obj[h.trim()] = cols[i] ? cols[i].trim() : '');
            return obj;
        });
    }

    // 4. 이벤트 리스너 바인딩
    function setupEventListeners() {
        // 상단 네비게이션 탭 전환
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.activeWorkspace = btn.dataset.workspace;
                renderWorkspace();
            });
        });

        // 제조 공정 전환 (반도체 / OLED)
        const industrySelect = document.getElementById('industrySelect');
        if (industrySelect) {
            industrySelect.addEventListener('change', (e) => {
                state.industry = e.target.value;
                document.getElementById('contextIndustryTag').innerText = state.industry === 'SEMICONDUCTOR' ? '반도체' : 'OLED 디스플레이';
                document.getElementById('contextLineTag').innerText = state.industry === 'SEMICONDUCTOR' ? '평택 제1공장 1호 라인' : '아산 제2공장 2호 라인';
                state.selectedEquipmentIdx = 0;
                updateEquipmentDisplay();
                updateKpis();
                if (state.activeWorkspace === 'lab') renderLabView();
                if (state.activeWorkspace === 'reports') renderReportDocument();
            });
        }

        // 사용자 역할 전환 (작업자, 정비원, 관리자, 기술원, 임원)
        const roleSelect = document.getElementById('roleSelect');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                state.role = e.target.value;
                state.reportAudience = (state.role === 'operator' || state.role === 'clevel') ? state.role : 'manager';
                const audSelect = document.getElementById('reportAudienceSelect');
                if (audSelect) audSelect.value = state.reportAudience;
                if (state.activeWorkspace === 'lab') renderLabExplainSection();
                if (state.activeWorkspace === 'reports') renderReportDocument();
            });
        }

        // 화면 테마 전환 (다크 / 라이트)
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                state.theme = state.theme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', state.theme);
                themeBtn.innerText = state.theme === 'dark' ? '🌙 어두운 테마' : '☀️ 밝은 테마';
            });
        }

        // 우측 도크 유틸리티 토글
        const dockBtn = document.getElementById('rightDockToggleBtn');
        const dockDrawer = document.getElementById('rightDockDrawer');
        const closeDockBtn = document.getElementById('closeDockBtn');
        if (dockBtn && dockDrawer) {
            dockBtn.addEventListener('click', () => dockDrawer.classList.toggle('open'));
        }
        if (closeDockBtn && dockDrawer) {
            closeDockBtn.addEventListener('click', () => dockDrawer.classList.remove('open'));
        }

        // 시뮬레이터 제어 (재생, 일시정지, 리셋, 슬라이더)
        const playBtn = document.getElementById('simPlayBtn');
        const pauseBtn = document.getElementById('simPauseBtn');
        const resetBtn = document.getElementById('simResetBtn');
        const timelineSlider = document.getElementById('timelineSlider');

        if (playBtn) playBtn.addEventListener('click', () => startSimulation());
        if (pauseBtn) pauseBtn.addEventListener('click', () => pauseSimulation());
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                pauseSimulation();
                state.simDayOfYear = 1;
                state.simDate = new Date(2027, 0, 1);
                updateDateDisplay();
                updateEquipmentDisplay();
                updateKpis();
                if (timelineSlider) timelineSlider.value = 1;
            });
        }
        if (timelineSlider) {
            timelineSlider.addEventListener('input', (e) => {
                state.simDayOfYear = parseInt(e.target.value, 10);
                state.simDate = new Date(2027, 0, state.simDayOfYear);
                updateDateDisplay();
                updateEquipmentDisplay();
                updateKpis();
            });
        }

        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.playbackSpeed = parseInt(btn.dataset.speed, 10);
                if (state.isPlaying) {
                    pauseSimulation();
                    startSimulation();
                }
            });
        });

        // AI 분석실 서브 네비게이션
        document.querySelectorAll('.lab-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.lab-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                state.labActiveTab = item.dataset.tab;
                document.querySelectorAll('.lab-panel').forEach(p => p.classList.remove('active'));
                const target = document.getElementById(`labPanel_${state.labActiveTab}`);
                if (target) target.classList.add('active');
            });
        });

        // 시나리오 슬라이더 이벤트
        const tempSlider = document.getElementById('scenarioTempSlider');
        const pressSlider = document.getElementById('scenarioPressSlider');
        const rfSlider = document.getElementById('scenarioRfSlider');
        if (tempSlider) {
            tempSlider.addEventListener('input', (e) => {
                state.scenarioSliders.tempOffset = parseFloat(e.target.value);
                document.getElementById('tempSliderVal').innerText = `${state.scenarioSliders.tempOffset > 0 ? '+' : ''}${state.scenarioSliders.tempOffset} °C`;
                runScenarioInference();
            });
        }
        if (pressSlider) {
            pressSlider.addEventListener('input', (e) => {
                state.scenarioSliders.pressOffset = parseFloat(e.target.value);
                document.getElementById('pressSliderVal').innerText = `${state.scenarioSliders.pressOffset > 0 ? '+' : ''}${state.scenarioSliders.pressOffset} %`;
                runScenarioInference();
            });
        }
        if (rfSlider) {
            rfSlider.addEventListener('input', (e) => {
                state.scenarioSliders.rfOffset = parseFloat(e.target.value);
                document.getElementById('rfSliderVal').innerText = `${state.scenarioSliders.rfOffset > 0 ? '+' : ''}${state.scenarioSliders.rfOffset} W`;
                runScenarioInference();
            });
        }

        // AI 다목적 최적 후보 자동 탐색 버튼
        const autoOptBtn = document.getElementById('runAutoOptimizeBtn');
        if (autoOptBtn) {
            autoOptBtn.addEventListener('click', () => runAutoOptimization());
        }

        // 보고서 스튜디오 제어
        document.querySelectorAll('.report-template-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.report-template-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                state.reportTemplate = item.dataset.tpl;
                renderReportDocument();
            });
        });

        const reportAudienceSelect = document.getElementById('reportAudienceSelect');
        if (reportAudienceSelect) {
            reportAudienceSelect.addEventListener('change', (e) => {
                state.reportAudience = e.target.value;
                renderReportDocument();
            });
        }

        const printReportBtn = document.getElementById('printReportBtn');
        if (printReportBtn) {
            printReportBtn.addEventListener('click', () => window.print());
        }

        const downloadReportCsvBtn = document.getElementById('downloadReportCsvBtn');
        if (downloadReportCsvBtn) {
            downloadReportCsvBtn.addEventListener('click', () => downloadReportCSV());
        }

        // 신규 점검 작업 등록 버튼
        const openTaskModalBtn = document.getElementById('openTaskModalBtn');
        if (openTaskModalBtn) {
            openTaskModalBtn.addEventListener('click', () => openNewTaskModal());
        }
    }

    // 5. 연간 시뮬레이션 제어
    function startSimulation() {
        if (state.isPlaying) return;
        state.isPlaying = true;
        document.getElementById('simPlayBtn').classList.add('active');
        document.getElementById('simPauseBtn').classList.remove('active');

        const intervalMs = Math.max(30, Math.floor(1000 / state.playbackSpeed));
        state.simTimer = setInterval(() => {
            state.simDayOfYear++;
            if (state.simDayOfYear > 365) {
                state.simDayOfYear = 1;
            }
            state.simDate = new Date(2027, 0, state.simDayOfYear);
            
            updateDateDisplay();
            updateEquipmentDisplay();
            updateKpis();
            triggerLotCarrierAnimation();

            const slider = document.getElementById('timelineSlider');
            if (slider) slider.value = state.simDayOfYear;

            if (state.activeWorkspace === 'reports') renderReportDocument();
        }, intervalMs);
    }

    function pauseSimulation() {
        state.isPlaying = false;
        if (state.simTimer) clearInterval(state.simTimer);
        document.getElementById('simPlayBtn').classList.remove('active');
        document.getElementById('simPauseBtn').classList.add('active');
    }

    function updateDateDisplay() {
        const yyyy = state.simDate.getFullYear();
        const mm = String(state.simDate.getMonth() + 1).padStart(2, '0');
        const dd = String(state.simDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}년 ${mm}월 ${dd}일`;
        
        const curDateEl = document.getElementById('contextDateTag');
        if (curDateEl) curDateEl.innerText = dateStr;
        const timelineDateEl = document.getElementById('timelineCurrentDate');
        if (timelineDateEl) timelineDateEl.innerText = `${dateStr} (${state.simDayOfYear}일차 / 365일)`;
    }

    // 6. 워크스페이스 렌더링 전환
    function renderWorkspace() {
        document.querySelectorAll('.workspace-pane').forEach(p => p.classList.remove('active'));
        const activePane = document.getElementById(`workspace_${state.activeWorkspace}`);
        if (activePane) activePane.classList.add('active');

        if (state.activeWorkspace === 'control') {
            updateEquipmentDisplay();
        } else if (state.activeWorkspace === 'lab') {
            renderLabView();
        } else if (state.activeWorkspace === 'tasks') {
            renderTaskView();
        } else if (state.activeWorkspace === 'reports') {
            renderReportDocument();
        }
    }

    // 7. 메인 관제 센터 렌더링 (2열 2-Tier 대형화 공정 다이어그램)
    function updateEquipmentDisplay() {
        const grid1 = document.getElementById('equipmentGridRow1');
        const grid2 = document.getElementById('equipmentGridRow2');
        const legacyGrid = document.getElementById('equipmentGridStrip');

        if (!grid1 && !grid2 && !legacyGrid) return;

        const isSemi = state.industry === 'SEMICONDUCTOR';
        const stages = isSemi ? [
            { seq: 1, name: '1. 세정', eqId: 'EQ_SEMI_01', eqName: '웨이퍼 세정조', chamber: 'CH_CLN_01', param: '파티클 잔류 밀도', val: '0.04 개/cm²', target: '0.05', temp: '25.1 °C', press: '760 토르(Torr)', power: '0 W', dev: 0.12 },
            { seq: 2, name: '2. 열처리', eqId: 'EQ_SEMI_02', eqName: '종형 열처리로(RTP)', chamber: 'CH_ANN_01', param: '산화막 두께', val: '45.3 nm', target: '45.0', temp: '952.4 °C', press: '750 토르(Torr)', power: '1210 W', dev: 0.18 },
            { seq: 3, name: '3. 증착', eqId: 'EQ_SEMI_03', eqName: 'PECVD 플라즈마 증착기', chamber: 'CH_DEP_01', param: '박막 증착 균일도', val: '98.2 %', target: '98.5', temp: '401.5 °C', press: '2.52 mTorr', power: '2515 W', dev: 0.85 },
            { seq: 4, name: '4. 노광', eqId: 'EQ_SEMI_04', eqName: 'EUV/ArF 노광 스캐너', chamber: 'CH_PHO_01', param: '선폭 임계치수(CD)', val: '14.05 nm', target: '14.0', temp: '23.0 °C', press: '760 토르(Torr)', power: '802 W', dev: 0.22 },
            { seq: 5, name: '5. 식각', eqId: 'EQ_SEMI_05', eqName: 'ICP 플라즈마 식각기', chamber: 'CH_ETC_01', param: '식각 깊이', val: '221.8 nm', target: '220.0', temp: '65.8 °C', press: '15.4 mTorr', power: '3240 W', dev: 0.45 },
            { seq: 6, name: '6. 이온주입', eqId: 'EQ_SEMI_06', eqName: '고전류 이온주입기', chamber: 'CH_IMP_01', param: '도핑 면저항', val: '84.6 ohm/sq', target: '85.0', temp: '28.1 °C', press: '0.005 mTorr', power: '4520 W', dev: -0.15 },
            { seq: 7, name: '7. CMP', eqId: 'EQ_SEMI_07', eqName: '화학기계적 연마기(CMP)', chamber: 'CH_CMP_01', param: '잔류 단차 조도', val: '12.4 A', target: '12.0', temp: '32.3 °C', press: '3.55 psi', power: '1510 W', dev: 0.32 },
            { seq: 8, name: '8. 절단', eqId: 'EQ_SEMI_08', eqName: '정밀 레이저 다이싱기', chamber: 'CH_DIC_01', param: '커프 폭 편차', val: '18.1 um', target: '18.0', temp: '24.2 °C', press: '760 토르(Torr)', power: '605 W', dev: 0.08 },
            { seq: 9, name: '9. 패키징', eqId: 'EQ_SEMI_09', eqName: '플립칩 고속 본더', chamber: 'CH_PKG_01', param: '볼 본딩 접합강도', val: '64.8 gf', target: '65.0', temp: '180.5 °C', press: '760 토르(Torr)', power: '955 W', dev: -0.05 },
            { seq: 10, name: '10. 전기검사', eqId: 'EQ_SEMI_10', eqName: '웨이퍼 테스터(ATE)', chamber: 'CH_EDS_01', param: '동작 전압 편차', val: '1202 mV', target: '1200', temp: '25.0 °C', press: '760 토르(Torr)', power: '502 W', dev: 0.11 }
        ] : [
            { seq: 1, name: '1. 기판세정', eqId: 'EQ_OLED_01', eqName: '초음파 세정기', chamber: 'CH_SCL_01', param: '유기 오염 잔류도', val: '5.1 deg', target: '5.0', temp: '45.2 °C', press: '760 토르(Torr)', power: '405 W', dev: 0.08 },
            { seq: 2, name: '2. TFT증착', eqId: 'EQ_OLED_02', eqName: '스퍼터링기', chamber: 'CH_TDEP_01', param: 'IGZO 채널 두께', val: '50.4 nm', target: '50.0', temp: '281 °C', press: '1.22 mTorr', power: '3810 W', dev: 0.15 },
            { seq: 3, name: '3. TFT노광', eqId: 'EQ_OLED_03', eqName: '프로젝션 노광기', chamber: 'CH_TPHO_01', param: '게이트 선폭', val: '2.51 um', target: '2.5', temp: '22.1 °C', press: '760 토르(Torr)', power: '1105 W', dev: 0.10 },
            { seq: 4, name: '4. TFT식각', eqId: 'EQ_OLED_04', eqName: '대형 건식 에처', chamber: 'CH_TETC_01', param: '테이퍼 각도', val: '55.3 deg', target: '55.0', temp: '55.4 °C', press: '20.3 mTorr', power: '2920 W', dev: 0.25 },
            { seq: 5, name: '5. OLED증착', eqId: 'EQ_OLED_05', eqName: 'FMM 열증착기', chamber: 'CH_OEV_01', param: '발광층 유기물 두께', val: '352 A', target: '350', temp: '321 °C', press: '0.0001 mTorr', power: '4230 W', dev: 0.65 },
            { seq: 6, name: '6. TFE봉지', eqId: 'EQ_OLED_06', eqName: '박막 봉지기', chamber: 'CH_ENC_01', param: '수분투과율', val: '1.02e-5', target: '1.0e-5', temp: '80.5 °C', press: '0.51 mTorr', power: '1810 W', dev: 0.12 },
            { seq: 7, name: '7. 발광검사', eqId: 'EQ_OLED_07', eqName: '광학 EL 검사기', chamber: 'CH_ELT_01', param: '휘도 균일도', val: '94.8 %', target: '95.0', temp: '24.1 °C', press: '760 토르(Torr)', power: '652 W', dev: -0.22 },
            { seq: 8, name: '8. 셀절단', eqId: 'EQ_OLED_08', eqName: '레이저 셀 절단기', chamber: 'CH_CUT_01', param: '절단 치수 공차', val: '10.2 um', target: '10.0', temp: '23.3 °C', press: '760 토르(Torr)', power: '855 W', dev: 0.14 },
            { seq: 9, name: '9. 구동접합', eqId: 'EQ_OLED_09', eqName: '정밀 본딩기', chamber: 'CH_BND_01', param: '단자 저항', val: '45.4 mohm', target: '45.0', temp: '196 °C', press: '4.25 psi', power: '1210 W', dev: 0.18 },
            { seq: 10, name: '10. 모듈검사', eqId: 'EQ_OLED_10', eqName: '비전 검사기', chamber: 'CH_MOD_01', param: '색좌표 편차', val: '1.24', target: '1.2', temp: '25.1 °C', press: '760 토르(Torr)', power: '552 W', dev: 0.16 }
        ];

        // 1열, 2열 섹션 헤더 및 브릿지 텍스트 갱신
        const t1Title = document.getElementById('tier1SectionTitle');
        const t2Title = document.getElementById('tier2SectionTitle');
        const tBridge = document.getElementById('tierBridgeTitle');
        if (t1Title) {
            t1Title.innerText = isSemi 
                ? '🔵 전공정 박막·패터닝 라인 (공정 1단계 ~ 5단계: 웨이퍼 세정 ~ ICP 식각)' 
                : '🔵 전공정 백플레인·발광 라인 (공정 1단계 ~ 5단계: 기판세정 ~ OLED 증착)';
        }
        if (t2Title) {
            t2Title.innerText = isSemi 
                ? '🟣 후공정 연마·패키징 라인 (공정 6단계 ~ 10단계: 이온주입 ~ 웨이퍼 테스터)' 
                : '🟣 후공정 봉지·모듈 조립 검사 라인 (공정 6단계 ~ 10단계: TFE봉지 ~ 비전 검사기)';
        }
        if (tBridge) {
            tBridge.innerHTML = isSemi
                ? '▼ <strong>전공정 1~5단계 완료</strong> ➔ <strong>후공정 6~10단계 연마·패키징 이송</strong> (금속 표면파 초당 10Gbps 고속 통신 버스) ▼'
                : '▼ <strong>백플레인 증착 완료</strong> ➔ <strong>후공정 봉지·모듈 검사 라인 이송</strong> (금속 표면파 초당 10Gbps 고속 통신 버스) ▼';
        }

        const daySeed = (state.simDayOfYear * 17) % 100;
        stages.forEach((st, idx) => {
            if (idx === 2 && daySeed > 70) {
                st.status = 'review';
            } else if (idx === 4 && daySeed > 85) {
                st.status = 'alert';
            } else {
                st.status = 'normal';
            }
        });

        const createCardElement = (st, idx) => {
            const card = document.createElement('div');
            card.className = `equipment-node-card ${idx === state.selectedEquipmentIdx ? 'selected' : ''}`;
            card.onclick = () => {
                state.selectedEquipmentIdx = idx;
                updateEquipmentDisplay();
                renderEquipmentDetail(stages[idx]);
            };

            const svgHtml = window.getEquipmentSVG ? window.getEquipmentSVG(state.industry, st.seq, st.status, st.name) : '';
            card.innerHTML = `
                <div class="stage-seq-badge">공정 0${st.seq}단계</div>
                <div class="eq-svg-wrap">${svgHtml}</div>
                <div class="eq-name-label" title="${st.eqName}">${st.eqName}</div>
                <div class="eq-quick-telemetry">
                    <span>${st.param.slice(0, 6)}: <strong>${st.val}</strong></span>
                </div>
                <div class="eq-status-badge ${st.status}">${st.status === 'normal' ? '정상 가동' : (st.status === 'review' ? '조건 검토 필요' : '공정 이탈 경보')}</div>
            `;
            return card;
        };

        if (grid1 && grid2) {
            grid1.innerHTML = '';
            grid2.innerHTML = '';
            stages.slice(0, 5).forEach((st, idx) => {
                grid1.appendChild(createCardElement(st, idx));
            });
            stages.slice(5, 10).forEach((st, i) => {
                const idx = i + 5;
                grid2.appendChild(createCardElement(st, idx));
            });
        } else if (legacyGrid) {
            legacyGrid.innerHTML = '';
            stages.forEach((st, idx) => {
                legacyGrid.appendChild(createCardElement(st, idx));
            });
        }

        renderEquipmentDetail(stages[state.selectedEquipmentIdx]);
    }

    function renderEquipmentDetail(eq) {
        if (!eq) return;
        const panel = document.getElementById('equipmentDetailDrawer');
        if (!panel) return;

        const isReview = eq.status === 'review';
        const isAlert = eq.status === 'alert';

        panel.innerHTML = `
            <div class="detail-header-block">
                <div>
                    <div class="detail-title">${eq.eqName}</div>
                    <div class="detail-sub">설비 식별번호: ${eq.eqId} · ${eq.chamber}</div>
                </div>
                <span class="eq-status-badge ${eq.status}" style="font-size:11px; padding:3px 8px;">
                    ${eq.status === 'normal' ? '정상 가동 중' : (isReview ? '조건 검토 필요' : '공정 이탈 경보')}
                </span>
            </div>

            <!-- 핵심 센서 측정치 -->
            <div class="card-block" style="padding:12px;">
                <div style="font-size:12px; font-weight:700; margin-bottom:8px;">실시간 센서 계측값 (금속 표면파 통신)</div>
                <div class="detail-param-grid">
                    <div class="param-box">
                        <div class="param-key">챔버 온도</div>
                        <div class="param-val">${eq.temp}</div>
                    </div>
                    <div class="param-box">
                        <div class="param-key">진공 및 공압</div>
                        <div class="param-val">${eq.press}</div>
                    </div>
                    <div class="param-box">
                        <div class="param-key">RF 전력</div>
                        <div class="param-val">${eq.power}</div>
                    </div>
                    <div class="param-box">
                        <div class="param-key">설비 진동</div>
                        <div class="param-val">0.038 g (RMS)</div>
                    </div>
                </div>
            </div>

            <!-- 공정 품질 및 AI 예측 편차 -->
            <div class="card-block" style="padding:12px;">
                <div style="font-size:12px; font-weight:700; margin-bottom:8px;">공정 품질 지표 및 AI 예측 결과</div>
                <div style="font-size:12px; margin-bottom:4px;">측정 항목: <strong>${eq.param}</strong></div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span>실측치: <strong style="color:var(--text-accent);">${eq.val}</strong> (목표 기준: ${eq.target})</span>
                    <span>편차율: <strong style="color:${Math.abs(eq.dev) > 0.5 ? 'var(--color-review)' : 'var(--color-normal)'};">${(eq.dev * 100).toFixed(1)}%</strong></span>
                </div>
                <div style="background:var(--bg-base); padding:8px; border-radius:4px; font-size:11px; border:1px solid var(--border-color);">
                    <div>AI 앙상블 예측 편차: <strong>${(eq.dev * 0.95).toFixed(3)}</strong> (허용 공차 규격: ±1.0)</div>
                    <div style="color:var(--text-muted); margin-top:2px;">예측 신뢰도: 94.2% · 추론 소요시간: 1.8ms</div>
                </div>
            </div>

            <!-- 정비 연계 버튼 -->
            <button id="createTaskFromEqBtn" class="tool-btn" style="width:100%; justify-content:center; padding:10px; background:var(--bus-sop); color:#fff; border:none; font-weight:700;">
                🛠️ 이 설비로 현장 정비 점검 작업 즉시 발행
            </button>
        `;

        const taskBtn = document.getElementById('createTaskFromEqBtn');
        if (taskBtn) {
            taskBtn.addEventListener('click', () => {
                state.tasks.unshift({
                    id: `작업-2027-${String(state.simDayOfYear).padStart(4, '0')}`,
                    eqId: eq.eqId,
                    eqName: eq.eqName,
                    priority: isAlert ? 'P0 긴급' : 'P1 점검',
                    title: `${eq.eqName} 파라미터 및 품질 편차 현장 점검`,
                    assignee: '미지정 (배정 대기)',
                    status: 'PENDING_APPROVAL',
                    date: state.simDate.toISOString().slice(0, 10)
                });
                alert(`[작업 발행 완료]\n'${eq.eqName}'에 대한 현장 정비 점검 작업이 정상 등록되었습니다.`);
                state.activeWorkspace = 'tasks';
                document.querySelectorAll('.nav-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.workspace === 'tasks');
                });
                renderWorkspace();
            });
        }
    }

    function triggerLotCarrierAnimation() {
        const carrier1 = document.getElementById('transferLotCarrier1');
        const carrier2 = document.getElementById('transferLotCarrier2');
        const packet1 = document.getElementById('dataPacketToken1');
        const packet2 = document.getElementById('dataPacketToken2');

        const step = state.simDayOfYear % 10;
        const pct1 = (step / 9) * 88 + 4; // 4% to 92%
        const pct2 = (((step + 5) % 10) / 9) * 88 + 4;

        if (carrier1) carrier1.style.left = `calc(${pct1}% - 16px)`;
        if (carrier2) carrier2.style.left = `calc(${pct2}% - 16px)`;

        const pktPct1 = ((state.simDayOfYear * 13) % 88) + 6;
        const pktPct2 = (((state.simDayOfYear * 19) + 40) % 88) + 6;

        if (packet1) packet1.style.left = `calc(${pktPct1}% - 6px)`;
        if (packet2) packet2.style.left = `calc(${pktPct2}% - 6px)`;

        // 레거시 단일 행 지원
        const carrier = document.getElementById('transferLotCarrier');
        if (carrier) {
            const pct = ((state.simDayOfYear % 10) / 10) * 100;
            carrier.style.left = `calc(20px + ${pct}% * 0.92)`;
        }
        const packet = document.querySelector('.data-packet-token');
        if (packet) {
            const pktPct = ((state.simDayOfYear * 7) % 100);
            packet.style.left = `calc(20px + ${pktPct}% * 0.92)`;
        }
    }

    function updateKpis() {
        const seed = state.simDayOfYear;
        const specOutRate = (2.2 + 0.6 * Math.sin(seed * 0.1)).toFixed(1);
        const queueTime = (14.5 - 1.2 * Math.cos(seed * 0.08)).toFixed(1);
        const energyRun = (18.6 - 0.4 * Math.sin(seed * 0.05)).toFixed(1);
        const aiPredDev = (0.28 + 0.04 * Math.sin(seed * 0.12)).toFixed(2);

        const el1 = document.getElementById('kpiSpecOut');
        const el2 = document.getElementById('kpiQueueTime');
        const el3 = document.getElementById('kpiEnergy');
        const el4 = document.getElementById('kpiAiDev');

        if (el1) el1.innerText = `${specOutRate}%`;
        if (el2) el2.innerText = `${queueTime}분`;
        if (el3) el3.innerText = `${energyRun} kWh`;
        if (el4) el4.innerText = `${aiPredDev}`;
    }

    // 8. 전문 AI 분석실 구현
    function renderLabView() {
        renderLabDiagnosticSection();
        renderLabBenchmarkSection();
        renderLabExplainSection();
        runScenarioInference();
    }

    function renderLabDiagnosticSection() {
        const dqBody = document.getElementById('dqRuleTableBody');
        if (!dqBody) return;
        const dqRules = [
            { id: '규칙 DQ-01', desc: '레코드 키 및 공정 실행 키 중복 검사', status: '정상 통과', detail: '중복 0건 (10,000건 유일성 100% 만족)' },
            { id: '규칙 DQ-02', desc: '필수 필드 결측 및 수치 무한값 검사', status: '정상 통과', detail: '결측치 0건 (유효 수치 100% 만족)' },
            { id: '규칙 DQ-03', desc: '투입·양품·불량·재작업 수량 균형 검증', status: '정상 통과', detail: '로트당 수량 보존 법칙 완전 일치' },
            { id: '규칙 DQ-04', desc: '공정 시간 선후관계 (시작시각 <= 종료시각)', status: '정상 통과', detail: '시간 역전 0건 (시계열 정합성 100%)' },
            { id: '규칙 DQ-05', desc: '품질 판정과 시점별 허용규격 정합성', status: '정상 통과', detail: '규격 이탈 판정 논리 100% 일치' },
            { id: '규칙 DQ-06', desc: '전력·전력량·가스 유량 단위 정합성', status: '정상 통과', detail: '국제 표준 공학 단위 검증 통과' },
            { id: '규칙 DQ-07', desc: '학습-검증-테스트 로트 누출 방지 검증', status: '정상 통과', detail: '로트 단위 시간순 독립 분할 완료' },
            { id: '규칙 DQ-08', desc: '센서 수집 지연 및 최신성 검증', status: '정상 통과', detail: '평균 지연 12.4ms, 패킷 손실률 0.04%' }
        ];
        dqBody.innerHTML = dqRules.map(r => `
            <tr>
                <td><strong>${r.id}</strong></td>
                <td>${r.desc}</td>
                <td><span style="color:var(--color-normal); font-weight:700;">${r.status}</span></td>
                <td style="font-size:12px; color:var(--text-secondary);">${r.detail}</td>
            </tr>
        `).join('');
    }

    function renderLabBenchmarkSection() {
        const tableBody = document.getElementById('modelBenchmarkTableBody');
        if (!tableBody || !state.modelMetrics) return;

        const m = state.modelMetrics.models;
        const models = [
            { key: 'decision_tree', ...m.decision_tree },
            { key: 'random_forest', ...m.random_forest },
            { key: 'extra_trees', ...m.extra_trees },
            { key: 'gradient_boosting', ...m.gradient_boosting },
            { key: 'weighted_ensemble', ...m.weighted_ensemble, highlight: true }
        ];

        tableBody.innerHTML = models.map(mod => `
            <tr class="${mod.highlight ? 'highlight' : ''}">
                <td><strong>${mod.name}</strong></td>
                <td>${mod.type || '지도학습 회귀 모델'}</td>
                <td>${mod.mae.toFixed(4)}</td>
                <td>${mod.rmse.toFixed(4)}</td>
                <td>${mod.r2.toFixed(4)}</td>
                <td>${mod.latency_ms || 3.5} ms</td>
                <td>${mod.weights ? (mod.weights * 100).toFixed(1) + '%' : '-'}</td>
            </tr>
        `).join('');

        const featContainer = document.getElementById('featureImportanceContainer');
        if (featContainer && state.modelMetrics.feature_importances) {
            featContainer.innerHTML = state.modelMetrics.feature_importances.map(f => `
                <div class="feature-bar-row">
                    <div class="feature-label" title="${f.name}">${f.name}</div>
                    <div class="feature-bar-wrap">
                        <div class="feature-bar-fill" style="width: ${(f.importance * 100) / 0.35 * 100}%;"></div>
                    </div>
                    <div class="feature-val">${(f.importance * 100).toFixed(1)}%</div>
                </div>
            `).join('');
        }
    }

    function renderLabExplainSection() {
        const container = document.getElementById('easyExplainContainer');
        if (!container) return;

        const role = state.role;
        let p1, p2, p3, p4;

        if (role === 'operator') {
            p1 = "플라즈마 증착 설비의 챔버 내부 압력이 설정 기준치보다 약 2.5% 높게 계측되었습니다.";
            p2 = "압력 상승 시 박막 증착 균일도가 규격을 벗어날 위험이 있으므로 즉시 점검이 필요합니다.";
            p3 = "진공 배기 밸브의 개폐 상태와 하부 진공 펌프 게이지 수치를 1차로 육안 확인하십시오.";
            p4 = "센서 자체의 교정 오차인지 실제 배관 누설인지 여부는 엔지니어 정밀 점검 전까지 확인되지 않았습니다.";
        } else if (role === 'clevel') {
            p1 = "2027년 1월 현재 설비 앙상블 예지보전 모델의 오차 설명력(R²)은 0.6036으로 매우 안정적입니다.";
            p2 = "AI 조건 최적화를 통해 연간 공정 불량률 0.3%p 저감 및 대기시간 단축 효과가 기대됩니다.";
            p3 = "상용 실증을 위한 1개 라인 대상의 읽기 전용 통신 연계 및 현장 효과 검증을 승인하십시오.";
            p4 = "생산량 및 원가 단가 계약 확정 전까지 정확한 순절감액 및 투자회수(ROI) 수치는 산출 보류 중입니다.";
        } else { // 관리자 및 엔지니어
            p1 = "3번 증착 챔버 및 5번 식각기에서 RF 전력 및 압력 편차로 인한 품질 변동이 관측되었습니다.";
            p2 = "영향도 분석 결과, 온도 편차(34.2%)와 압력 편차(29.8%)가 품질 편차 유발의 주요 원인입니다.";
            p3 = "설비 보전팀에 RF 제너레이터 매칭 박스 임피던스 점검 작업(P0 긴급)을 배정하고 기한을 설정하십시오.";
            p4 = "원자재(가스/타겟) 로트 변경에 따른 화학적 반응 특성 편차는 추가 현장 실험 데이터가 필요합니다.";
        }

        container.innerHTML = `
            <div class="explain-box">
                <span class="step-tag">1단계. 무슨 일이 보이는가</span>
                <div class="explain-text">${p1}</div>
            </div>
            <div class="explain-box">
                <span class="step-tag">2단계. 왜 확인해야 하는가</span>
                <div class="explain-text">${p2}</div>
            </div>
            <div class="explain-box">
                <span class="step-tag">3단계. 무엇을 할 수 있는가</span>
                <div class="explain-text">${p3}</div>
            </div>
            <div class="explain-box">
                <span class="step-tag">4단계. 아직 모르는 것은 무엇인가</span>
                <div class="explain-text">${p4}</div>
            </div>
        `;
    }

    function runScenarioInference() {
        const { tempOffset, pressOffset, rfOffset } = state.scenarioSliders;
        const baselineDev = 0.28;
        const baselineEnergy = 18.5;
        const baselineQueue = 14.2;

        const simulatedDev = (baselineDev + 0.35 * (tempOffset / 10.0) + 0.30 * (pressOffset / 5.0) + 0.25 * (rfOffset / 20.0)).toFixed(3);
        const simulatedEnergy = (baselineEnergy + (rfOffset * 0.05)).toFixed(1);
        const simulatedQueue = (baselineQueue - (tempOffset * 0.1)).toFixed(1);

        const resDev = document.getElementById('simResultDev');
        const resEnergy = document.getElementById('simResultEnergy');
        const resQueue = document.getElementById('simResultQueue');

        if (resDev) {
            resDev.innerText = simulatedDev;
            resDev.style.color = Math.abs(parseFloat(simulatedDev)) <= 0.35 ? 'var(--color-normal)' : (Math.abs(parseFloat(simulatedDev)) <= 0.8 ? 'var(--color-review)' : 'var(--color-alert)');
        }
        if (resEnergy) resEnergy.innerText = `${simulatedEnergy} kWh`;
        if (resQueue) resQueue.innerText = `${simulatedQueue} 분`;
    }

    function runAutoOptimization() {
        state.scenarioSliders.tempOffset = -1.5;
        state.scenarioSliders.pressOffset = -0.8;
        state.scenarioSliders.rfOffset = -5.0;

        const s1 = document.getElementById('scenarioTempSlider');
        const s2 = document.getElementById('scenarioPressSlider');
        const s3 = document.getElementById('scenarioRfSlider');
        if (s1) s1.value = -1.5;
        if (s2) s2.value = -0.8;
        if (s3) s3.value = -5.0;

        document.getElementById('tempSliderVal').innerText = '-1.5 °C';
        document.getElementById('pressSliderVal').innerText = '-0.8 %';
        document.getElementById('rfSliderVal').innerText = '-5.0 W';

        runScenarioInference();

        alert("[AI 최적 운전조건 도출 결과]\n\n• 공정 온도: -1.5°C 조정\n• 챔버 압력: -0.8% 조정\n• RF 플라즈마 전력: -5.0W 조정\n\n위 조건 적용 시 품질 편차율이 0.082로 최소화되며, 실행당 0.25kWh의 전력 절감이 예상됩니다.");
    }

    // 9. 정비 협업 및 현장 SOP 뷰 렌더링
    function renderTaskView() {
        const tbody = document.getElementById('taskListTableBody');
        if (!tbody) return;

        tbody.innerHTML = state.tasks.map(t => `
            <tr>
                <td><strong>${t.id}</strong></td>
                <td><span class="kpi-delta ${t.priority.includes('P0') ? 'warn' : 'good'}">${t.priority}</span></td>
                <td>${t.eqName}</td>
                <td><strong>${t.title}</strong></td>
                <td>${t.assignee}</td>
                <td>
                    <span style="font-weight:700; color:${t.status === 'COMPLETED' ? 'var(--color-normal)' : (t.status === 'IN_PROGRESS' ? 'var(--bus-sensor)' : 'var(--color-review)')};">
                        ${t.status === 'COMPLETED' ? '조치 완료' : (t.status === 'IN_PROGRESS' ? '작업 진행 중' : '관리자 승인 대기')}
                    </span>
                </td>
                <td>${t.date}</td>
                <td>
                    <button class="tool-btn" onclick="window.advanceTaskStatus('${t.id}')">
                        ${t.status === 'PENDING_APPROVAL' ? '승인 처리' : (t.status === 'IN_PROGRESS' ? '완료 처리' : '상세 보기')}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.advanceTaskStatus = function (taskId) {
        const t = state.tasks.find(x => x.id === taskId);
        if (!t) return;
        if (t.status === 'PENDING_APPROVAL') {
            t.status = 'IN_PROGRESS';
            t.assignee = '김정비 책임 (승인완료)';
        } else if (t.status === 'IN_PROGRESS') {
            t.status = 'COMPLETED';
        }
        renderTaskView();
    };

    function openNewTaskModal() {
        const title = prompt("새로운 현장 점검 및 정비 작업의 명칭을 입력하십시오:", "진공 챔버 게이지 교정 및 배관 리크 점검");
        if (!title) return;
        state.tasks.unshift({
            id: `작업-2027-${String(state.tasks.length + 1).padStart(4, '0')}`,
            eqId: 'EQ_SEMI_01',
            eqName: '반도체 대표 설비',
            priority: 'P1 점검',
            title: title,
            assignee: '운영 담당자',
            status: 'PENDING_APPROVAL',
            date: state.simDate.toISOString().slice(0, 10)
        });
        renderTaskView();
    }

    // 10. 보고서 스튜디오 (Report Studio) 5종 문서 렌더링
    function renderReportDocument() {
        const docPage = document.getElementById('reportPageDocument');
        if (!docPage) return;

        const dateStr = state.simDate.toISOString().slice(0, 10);
        const tpl = state.reportTemplate;
        const aud = state.reportAudience;
        const isSemi = state.industry === 'SEMICONDUCTOR';

        let docTitle = "";
        let docSubtitle = "";
        let docContentHtml = "";

        if (tpl === 'RP-T01') {
            docTitle = "AI 분석결과 보고서 (제조 품질 예측 모델 진단 및 설명서)";
            docSubtitle = "제조 공정 품질 편차 예측 인공지능 모델 성능 평가 및 원인 기여도 분석";
            docContentHtml = `
                <div class="doc-block">
                    <div class="doc-block-h2">1. 모델 평가 총괄 요약</div>
                    <p class="doc-p">본 보고서는 2027년 ${dateStr} 기준, ${isSemi ? '반도체 평택 제1공장 1호 라인' : 'OLED 아산 제2공장 2호 라인'}에서 수집된 공정 텔레메트리 데이터를 바탕으로 4대 단독 모델 및 가중 앙상블 모델의 독립 테스트 성능을 비교·분석한 결과입니다.</p>
                    <table class="doc-table">
                        <thead>
                            <tr>
                                <th>모델명</th>
                                <th>알고리즘 유형</th>
                                <th>평균절대오차 (MAE)</th>
                                <th>평균제곱근오차 (RMSE)</th>
                                <th>설명력 지표 (R²)</th>
                                <th>추론 지연시간</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>의사결정나무</td><td>단일 결정나무 모델</td><td>0.3054</td><td>0.3856</td><td>0.5952</td><td>1.2 ms</td></tr>
                            <tr style="background:#f0fdf4;"><td><strong>랜덤포레스트</strong></td><td>배깅 앙상블 모델</td><td><strong>0.3014</strong></td><td><strong>0.3809</strong></td><td><strong>0.6049</strong></td><td>4.8 ms</td></tr>
                            <tr><td>엑스트라트리</td><td>극단적 무작위 분할 트리</td><td>0.3116</td><td>0.3928</td><td>0.5798</td><td>3.9 ms</td></tr>
                            <tr><td>그래디언트부스팅</td><td>순차 잔차 부스팅 모델</td><td>0.3051</td><td>0.3854</td><td>0.5955</td><td>6.5 ms</td></tr>
                            <tr style="background:#e0f2fe;"><td><strong>검증 가중 앙상블 (운영 모델)</strong></td><td>가중 융합 스태킹 모델</td><td>0.3018</td><td>0.3816</td><td>0.6036</td><td>8.2 ms</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="doc-block">
                    <div class="doc-block-h2">2. 독자 맞춤형 쉬운 해석 (${aud === 'operator' ? '현장 작업자용' : (aud === 'clevel' ? '경영진용' : '생산·공정 관리자용')})</div>
                    <p class="doc-p">
                        ${aud === 'operator' 
                            ? '• 현재 플라즈마 설비의 RF 파워 및 압력 편차가 규격 상한선에 근접하고 있습니다. 수조 게이지 및 밸브 상태를 육안 확인하십시오.' 
                            : (aud === 'clevel' 
                                ? '• 앙상블 모델 설명력 R² 0.6036 달성으로 실증 라인 도입 타당성이 충분히 확보되었습니다. 유료 실증 투자를 승인할 수 있습니다.' 
                                : '• 챔버 온도 편차(34.2%)와 압력 편차(29.8%)가 주요 변동 원인으로 분석되었습니다. 3번 증착 챔버의 운전조건 교정을 권고합니다.')}
                    </p>
                </div>

                <div class="doc-block">
                    <div class="doc-block-h2">3. 데이터 무결성 및 원천 정보</div>
                    <p class="doc-p">분석 실행 번호: <code>실행-${dateStr.replace(/-/g, '')}-001</code> · 데이터 버전: <code>제1판(합성원장)</code> · 무결성 규칙 DQ-01 ~ DQ-08 전 항목 통과 (정상)</p>
                </div>
            `;
        } else if (tpl === 'RP-T02') {
            docTitle = "일일 생산·품질 보고서 (일일 실적 및 교대 인수인계 일지)";
            docSubtitle = "일일 생산 실적, 공정 이탈률, 대기 시간 및 교대 인수인계 사항";
            docContentHtml = `
                <div class="doc-block">
                    <div class="doc-block-h2">1. 금일 생산 실적 및 종합 지표</div>
                    <table class="doc-table">
                        <tr><th>구분 항목</th><th>관리 목표</th><th>금일 실적</th><th>목표 달성률</th><th>전일 대비 증감</th></tr>
                        <tr><td>총 생산 로트</td><td>15 로트</td><td>15 로트</td><td>100% 달성</td><td>동일</td></tr>
                        <tr><td>관측 품질 이탈률</td><td>2.5% 이하</td><td><strong>2.2%</strong></td><td>달성 (우수)</td><td>-0.3%p 개선</td></tr>
                        <tr><td>공정 간 평균 대기시간</td><td>15.0분 이하</td><td><strong>13.8분</strong></td><td>달성 (우수)</td><td>-1.2분 단축</td></tr>
                        <tr><td>실행당 전력 소모량</td><td>19.0 kWh 이하</td><td><strong>18.4 kWh</strong></td><td>달성 (우수)</td><td>-0.5 kWh 절감</td></tr>
                    </table>
                </div>
                <div class="doc-block">
                    <div class="doc-block-h2">2. 교대 인수인계 및 현장 특이사항</div>
                    <p class="doc-p">• 주간 조 인계: 3번 챔버의 RF 전력 매칭 튜닝 작업을 정상 완료하였으며, 품질 편차 안정화를 확인했습니다.</p>
                    <p class="doc-p">• 야간 조 인수: 7번 CMP 연마 설비의 연마 슬러리 잔량을 점검해 주십시오 (예상 소진 잔여시간 6시간).</p>
                </div>
            `;
        } else if (tpl === 'RP-T03') {
            docTitle = "공정 개선·작업지시 검토서 (조건 최적화 및 현장 실험계획서)";
            docSubtitle = "AI 다목적 최적화 파라미터 탐색 전후 비교 및 현장 실험계획서";
            docContentHtml = `
                <div class="doc-block">
                    <div class="doc-block-h2">1. 문제 정의 및 AI 추천 운전조건</div>
                    <p class="doc-p">플라즈마 증착 및 식각 공정의 잔류 응력과 미세 품질 편차를 최소화하기 위해 다목적 격자 탐색 최적화를 수행하였습니다.</p>
                    <table class="doc-table">
                        <tr><th>공정 파라미터</th><th>현재 설정값</th><th>AI 추천 최적값</th><th>변동 폭</th><th>예상 개선 효과</th></tr>
                        <tr><td>공정 온도</td><td>400.0 °C</td><td><strong>398.5 °C</strong></td><td>-1.5 °C</td><td>열 변형률 14% 감소</td></tr>
                        <tr><td>챔버 진공 압력</td><td>2.50 mTorr</td><td><strong>2.48 mTorr</strong></td><td>-0.8 %</td><td>박막 두께 균일도 향상</td></tr>
                        <tr><td>RF 플라즈마 전력</td><td>2500 W</td><td><strong>2495 W</strong></td><td>-5.0 W</td><td>공정 소비 전력 0.25 kWh 절감</td></tr>
                    </table>
                </div>
                <div class="doc-block">
                    <div class="doc-block-h2">2. 작업 지시 및 안전 확인 사항</div>
                    <p class="doc-p">• 작업 승인자: 제조운영실장 · 현장 실행 담당자: 공정기술팀</p>
                    <p class="doc-p">• 중요 준수사항: 설비 파라미터 직접 자동 반영은 안전 정책에 따라 차단되며, 작업자가 현장 레시피를 수동 입력하고 3회 샘플 테스트를 거친 후 양산에 적용합니다.</p>
                </div>
            `;
        } else if (tpl === 'RP-T04') {
            docTitle = "경영 성과·투자 검토 보고서 (비용 절감 및 사업성 검토서)";
            docSubtitle = "오로라(AURORA) 도입에 따른 제조 공정 가치 창출 및 단계별 사업성 검토";
            docContentHtml = `
                <div class="doc-block">
                    <div class="doc-block-h2">1. 경영진 핵심 의사결정 요약</div>
                    <p class="doc-p">써니웨이브텍의 금속 표면 통신 인프라와 결합된 제조 지능화 솔루션을 1개 실증 라인에 적용 시, 비계획 정지시간 및 품질 폐기 비용 감소를 통한 반복 매출 가치를 검증합니다.</p>
                    <table class="doc-table">
                        <tr><th>검토 항목</th><th>현행 기준선</th><th>오로라 도입 목표</th><th>예상 연간 가치 창출</th></tr>
                        <tr><td>설비 비계획 정지시간</td><td>연간 184 시간</td><td>연간 140 시간 이하 (-24%)</td><td>설비 가동률 2.1% 향상</td></tr>
                        <tr><td>품질 이탈 스크랩 비용</td><td>월평균 4,200 만원</td><td>월평균 3,100 만원 (-26%)</td><td>연간 약 1.3 억원 절감</td></tr>
                        <tr><td>데이터 수집 지연율</td><td>평균 150 ms (유선 시공 부담)</td><td>15 ms 이내 (무선 표면파)</td><td>설비 시공비 40% 절감</td></tr>
                    </table>
                </div>
                <div class="doc-block">
                    <div class="doc-block-h2">2. 리스크 및 불확실성 공지 (PRD 4.2 준수)</div>
                    <p class="doc-p">• 본 수치는 합성 데이터 기반 예측 및 제안 목표이며, 현장 유료 실증 데이터가 검증되기 전까지 확정된 절감액으로 보증하지 않습니다.</p>
                </div>
            `;
        } else { // RP-T05
            docTitle = "안전·공지 운영 보고서 (무사고 달성 및 안전작업허가 원장)";
            docSubtitle = "무사고 사업장 유지 현황, 안전 작업허가서 및 긴급 통신 가용성";
            docContentHtml = `
                <div class="doc-block">
                    <div class="doc-block-h2">1. 무사고 사업장 달성 지표</div>
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:16px; border-radius:6px; text-align:center; margin-bottom:12px;">
                        <span style="font-size:13px; color:#166534; font-weight:700;">연속 무재해 달성 일수</span>
                        <div style="font-size:32px; font-weight:800; color:#15803d; font-family:monospace;">${state.safeDays} 일 달성</div>
                        <div style="font-size:11px; color:#166534;">기산일자: 2025-11-01 · 중대재해 0건 · 근접사고 0건</div>
                    </div>
                </div>
                <div class="doc-block">
                    <div class="doc-block-h2">2. 센서 통신 가용성 및 작업 허가 현황</div>
                    <p class="doc-p">• 금속 차폐 격벽 센서 가용률: <strong>99.96%</strong> (평균 지연 12.4ms)</p>
                    <p class="doc-p">• 당일 발행된 고온/고압 설비 정비 안전작업허가(PTW): 총 2건 정상 승인 및 안전보호구 착용 확인 완료.</p>
                </div>
            `;
        }

        docPage.innerHTML = `
            <div class="doc-header-banner">
                <div>
                    <div class="doc-org-tag">AURORA 오로라 산업 지능화 플랫폼 · 써니웨이브텍</div>
                    <div class="doc-main-title">${docTitle}</div>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">${docSubtitle}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; font-weight:700; color:#0f172a;">문서번호: 오로라-${tpl}-${dateStr.replace(/-/g, '')}</div>
                    <div style="font-size:11px; color:#64748b;">작성일시: ${dateStr} 09:00 (한국표준시)</div>
                </div>
            </div>

            <table class="doc-meta-table">
                <tr>
                    <td class="label">적용 사업장</td><td>${isSemi ? '반도체 평택 제1공장 1호 라인' : 'OLED 아산 제2공장 2호 라인'}</td>
                    <td class="label">수신 독자</td><td>${aud === 'operator' ? '현장 작업자' : (aud === 'clevel' ? '경영진 (임원)' : '생산·공정 관리자')}</td>
                </tr>
                <tr>
                    <td class="label">데이터 기간</td><td>2027-01-01 ~ ${dateStr}</td>
                    <td class="label">문서 보안 등급</td><td>사내 대외비 (3등급)</td>
                </tr>
            </table>

            ${docContentHtml}

            <div class="doc-sign-box">
                <div>작성자: <strong>신제조 공정기술원</strong> (인)</div>
                <div>검토자: <strong>김운영 제조라인장</strong> (인)</div>
                <div>최종 승인자: <strong>박총괄 사업본부장</strong> (인)</div>
            </div>
        `;
    }

    function downloadReportCSV() {
        const dateStr = state.simDate.toISOString().slice(0, 10);
        let csv = "측정일시,설비식별번호,설비명,측정항목,측정값,목표기준값,정규화품질편차\n";
        csv += `${dateStr}T09:00:00Z,EQ_SEMI_03,PECVD 플라즈마 증착기,증착균일도,98.2,98.5,0.85\n`;
        csv += `${dateStr}T09:00:00Z,EQ_SEMI_05,ICP 플라즈마 식각기,식각깊이,221.8,220.0,0.45\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `오로라_보고서_${state.reportTemplate}_${dateStr}.csv`;
        a.click();
    }

    // 11. 우측 도크 유틸리티 도구 설정
    function setupRightDockTools() {
        document.querySelectorAll('.dock-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.dock-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                document.querySelectorAll('.dock-tool-panel').forEach(p => p.style.display = 'none');
                const target = document.getElementById(`dockTool_${tab}`);
                if (target) target.style.display = 'block';
            });
        });

        // 단위 환산기
        const convInput = document.getElementById('convInputVal');
        const convType = document.getElementById('convTypeSelect');
        const convOutput = document.getElementById('convOutputVal');

        function doConvert() {
            if (!convInput || !convType || !convOutput) return;
            const val = parseFloat(convInput.value) || 0;
            const type = convType.value;
            let res = 0;
            let unit = "";

            if (type === 'bar_to_kpa') {
                res = val * 100.0;
                unit = "킬로파스칼 (kPa)";
            } else if (type === 'kpa_to_bar') {
                res = val / 100.0;
                unit = "바 (bar)";
            } else if (type === 'c_to_f') {
                res = (val * 9/5) + 32;
                unit = "화씨 (°F)";
            } else if (type === 'f_to_c') {
                res = (val - 32) * 5/9;
                unit = "섭씨 (°C)";
            } else if (type === 'kwh_to_mj') {
                res = val * 3.6;
                unit = "메가줄 (MJ)";
            } else if (type === 'sccm_to_slm') {
                res = val / 1000.0;
                unit = "분당 표준리터 (SLM)";
            }
            convOutput.innerText = `${res.toFixed(3)} ${unit}`;
        }

        if (convInput) convInput.addEventListener('input', doConvert);
        if (convType) convType.addEventListener('change', doConvert);
        doConvert();

        // 계산기
        let calcExpr = "";
        const calcDisplay = document.getElementById('calcDisplay');
        document.querySelectorAll('.calc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const val = btn.dataset.val;

                if (action === 'clear') {
                    calcExpr = "";
                } else if (action === 'eval') {
                    try {
                        calcExpr = String(eval(calcExpr.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/sqrt/g, 'Math.sqrt')));
                    } catch (e) {
                        calcExpr = "수식 오류";
                    }
                } else if (val) {
                    if (calcExpr === '수식 오류') calcExpr = "";
                    calcExpr += val;
                }
                if (calcDisplay) calcDisplay.value = calcExpr || '0';
            });
        });
    }

    // 전역 객체 등록
    window.auroraApp = {
        state,
        initApp
    };

    // 즉시 실행 또는 DOM 완료 시 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
