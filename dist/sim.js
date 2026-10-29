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

    // 초기 기본 메트릭스 및 샘플 플롯 포인트
    const initialSamplePoints = Array.from({ length: 65 }, (_, i) => {
        const act = (Math.sin(i * 1.7) * 1.5 + Math.cos(i * 0.8) * 0.4);
        const noise = (Math.sin(i * 3.3) * 0.22);
        const pred = act * 0.94 + noise;
        return {
            record_id: `REC_09${100 + i}`,
            equipment_id: `EQ_SEMI_0${(i % 5) + 1}`,
            stage_name: ['웨이퍼 세정', '열처리로(RTP)', 'PECVD 증착', '노광 스캐너', '플라즈마 식각'][i % 5],
            actual: parseFloat(act.toFixed(3)),
            pred_ensemble: parseFloat(pred.toFixed(3)),
            residual: parseFloat((act - pred).toFixed(3)),
            temp_diff: parseFloat((act * 2.1).toFixed(2)),
            press_diff: parseFloat((noise * 1.4).toFixed(2))
        };
    });

    const initialModelMetrics = {
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
        ],
        test_sample_points: initialSamplePoints
    };

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
        modelMetrics: initialModelMetrics,
        
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

        // 지식그래프 및 SOP 라이프사이클 상태
        selectedKgNode: 'sop-01',
        kgFilter: 'ALL',
        kgSearchQuery: '',
        selectedSopStep: 1,
        
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
                renderRoleInsightStudio(state.role);
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
                if (state.labActiveTab === 'benchmark') renderLabBenchmarkSection();
                if (state.labActiveTab === 'explain') renderRoleInsightStudio(state.role);
            });
        });

        // AI 분석실 내 역할 탭 클릭 연동
        document.querySelectorAll('.role-insight-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const role = pill.dataset.role;
                state.role = role;
                const rSelect = document.getElementById('roleSelect');
                if (rSelect) rSelect.value = role;
                renderRoleInsightStudio(role);
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
        renderRoleInsightStudio(state.role || 'manager');
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

    // 8-1. AI 모델 성능 벤치마크 및 상용화 시각화 대시보드
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

        // [상용화 시각화 그래프 1] 실측값 vs AI 예측값 산포도 차트
        renderScatterPlot();

        // [상용화 시각화 그래프 2] 4대 모델 다차원 지표 비교 차트
        renderModelComparisonChart();

        // [공정변수 영향도 종합 대시보드 4종 차트 렌더링]
        renderFeatureRadarChart();
        renderFeatureDivergingChart();
        renderFeatureHeatmapChart();
        renderFeatureGauges();
        selectFeatureForDetail(0);
    }

    // [그래프 1] 실측치 vs AI 앙상블 예측치 산포도 플롯 (SVG)
    function renderScatterPlot() {
        const container = document.getElementById('scatterPlotContainer');
        if (!container || !state.modelMetrics || !state.modelMetrics.test_sample_points) return;

        const pts = state.modelMetrics.test_sample_points.slice(0, 85);
        const w = 520, h = 260;
        const x0 = 50, y0 = 20, pw = 450, ph = 200;
        const minVal = -2.2, maxVal = 2.2, span = 4.4;

        const toX = (val) => x0 + ((val - minVal) / span) * pw;
        const toY = (val) => (y0 + ph) - ((val - minVal) / span) * ph;

        // 허용 규격 박스 (-1.0 ~ +1.0)
        const boxX = toX(-1.0);
        const boxW = toX(1.0) - boxX;
        const boxY = toY(1.0);
        const boxH = toY(-1.0) - boxY;

        let gridLines = '';
        for (let v = -2; v <= 2; v += 1) {
            const gx = toX(v);
            const gy = toY(v);
            gridLines += `
                <line x1="${gx}" y1="${y0}" x2="${gx}" y2="${y0 + ph}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <line x1="${x0}" y1="${gy}" x2="${x0 + pw}" y2="${gy}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <text x="${gx}" y="${y0 + ph + 16}" fill="var(--text-secondary)" font-size="10" text-anchor="middle" font-family="var(--font-mono)">${v > 0 ? '+' + v + '.0' : v + '.0'}</text>
                <text x="${x0 - 8}" y="${gy + 3}" fill="var(--text-secondary)" font-size="10" text-anchor="end" font-family="var(--font-mono)">${v > 0 ? '+' + v + '.0' : v + '.0'}</text>
            `;
        }

        let circles = '';
        pts.forEach((p, idx) => {
            const cx = toX(p.actual);
            const cy = toY(p.pred_ensemble);
            const absRes = Math.abs(p.residual);
            const color = absRes <= 0.25 ? '#00e5ff' : (absRes <= 0.45 ? '#f59e0b' : '#ef4444');
            const tooltipContent = `[기록 ${p.record_id}] ${p.equipment_id} (${p.stage_name || '공정'})\n• 실측 품질편차: ${p.actual.toFixed(3)}\n• AI 앙상블 예측: ${p.pred_ensemble.toFixed(3)}\n• 잔차 절대오차: ${absRes.toFixed(3)}\n• 온도편차: ${p.temp_diff >= 0 ? '+' : ''}${p.temp_diff}°C | 압력: ${p.press_diff} mTorr`;

            circles += `
                <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${color}" fill-opacity="0.85" stroke="#ffffff" stroke-width="0.8" class="scatter-dot" data-tip="${encodeURIComponent(tooltipContent)}" style="cursor:pointer; transition:transform 0.15s ease;" />
            `;
        });

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="specAreaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="rgba(0, 229, 255, 0.08)" />
                        <stop offset="100%" stop-color="rgba(124, 77, 255, 0.04)" />
                    </linearGradient>
                </defs>

                <!-- 허용 규격 범위 영역 (±1.0 정상 공차) -->
                <rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" fill="url(#specAreaGrad)" stroke="rgba(0, 229, 255, 0.3)" stroke-dasharray="3,3" />
                <text x="${(boxX + boxW - 6).toFixed(1)}" y="${(boxY + 14).toFixed(1)}" fill="#00e5ff" font-size="9" font-weight="700" text-anchor="end">허용 규격 영역(±1.0)</text>

                <!-- 그리드 및 축 라벨 -->
                ${gridLines}

                <!-- X축 및 Y축 기준선 (0점) -->
                <line x1="${toX(0)}" y1="${y0}" x2="${toX(0)}" y2="${y0 + ph}" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />
                <line x1="${x0}" y1="${toY(0)}" x2="${x0 + pw}" y2="${toY(0)}" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" />

                <!-- y=x 완벽 예측 대각선 -->
                <line x1="${toX(-2.2)}" y1="${toY(-2.2)}" x2="${toX(2.2)}" y2="${toY(2.2)}" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="5,4" opacity="0.8" />

                <!-- 100개 테스트 샘플 플롯 점들 -->
                ${circles}

                <!-- 축 타이틀 -->
                <text x="${x0 + pw / 2}" y="${h - 4}" fill="var(--text-primary)" font-size="11" font-weight="700" text-anchor="middle">실측 품질 편차 (Actual Normalized Quality Deviation)</text>
                <text x="14" y="${y0 + ph / 2}" fill="var(--text-primary)" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 14 ${y0 + ph / 2})">AI 앙상블 예측치 (Predicted)</text>
            </svg>
        `;

        // 툴팁 이벤트 바인딩
        container.querySelectorAll('.scatter-dot').forEach(dot => {
            dot.addEventListener('mouseenter', (e) => {
                dot.setAttribute('r', '7');
                dot.setAttribute('stroke-width', '2');
                const raw = dot.getAttribute('data-tip');
                if (raw) showScatterTooltip(e, decodeURIComponent(raw));
            });
            dot.addEventListener('mousemove', (e) => {
                const raw = dot.getAttribute('data-tip');
                if (raw) showScatterTooltip(e, decodeURIComponent(raw));
            });
            dot.addEventListener('mouseleave', () => {
                dot.setAttribute('r', '4.5');
                dot.setAttribute('stroke-width', '0.8');
                hideScatterTooltip();
            });
        });
    }

    // [그래프 2] 4대 AI 모델 & 앙상블 다차원 성능 비교 차트 (SVG)
    function renderModelComparisonChart() {
        const container = document.getElementById('modelComparisonChartContainer');
        if (!container || !state.modelMetrics) return;

        const m = state.modelMetrics.models;
        const list = [
            { name: '의사결정나무', r2: m.decision_tree.r2 * 100, acc: (1 - m.decision_tree.mae) * 100, weight: (m.decision_tree.weights || 0.235) * 100 },
            { name: '랜덤포레스트', r2: m.random_forest.r2 * 100, acc: (1 - m.random_forest.mae) * 100, weight: (m.random_forest.weights || 0.270) * 100 },
            { name: '엑스트라트리', r2: m.extra_trees.r2 * 100, acc: (1 - m.extra_trees.mae) * 100, weight: (m.extra_trees.weights || 0.220) * 100 },
            { name: '그래디언트부스팅', r2: m.gradient_boosting.r2 * 100, acc: (1 - m.gradient_boosting.mae) * 100, weight: (m.gradient_boosting.weights || 0.275) * 100 },
            { name: '가중 앙상블(운영)', r2: m.weighted_ensemble.r2 * 100, acc: (1 - m.weighted_ensemble.mae) * 100, weight: 100, isBest: true }
        ];

        const w = 520, h = 260;
        const x0 = 45, y0 = 25, pw = 455, ph = 195;
        const groupW = pw / list.length;
        const barW = 16;
        const gap = 3;

        let groupsHtml = '';
        list.forEach((item, idx) => {
            const gx = x0 + idx * groupW;
            const cx = gx + groupW / 2;

            const hR2 = (item.r2 / 100) * ph;
            const hAcc = (item.acc / 100) * ph;
            const hW = ((item.isBest ? 45 : item.weight) / 100) * ph;

            const yR2 = (y0 + ph) - hR2;
            const yAcc = (y0 + ph) - hAcc;
            const yW = (y0 + ph) - hW;

            const b1X = cx - (barW * 1.5 + gap);
            const b2X = cx - (barW * 0.5);
            const b3X = cx + (barW * 0.5 + gap);

            const highlightBox = item.isBest ? `
                <rect x="${gx + 4}" y="${y0 - 10}" width="${groupW - 8}" height="${ph + 36}" rx="6" fill="rgba(0, 229, 255, 0.05)" stroke="rgba(0, 229, 255, 0.4)" stroke-dasharray="3,3" />
                <rect x="${cx - 30}" y="${y0 - 18}" width="60" height="15" rx="7.5" fill="#00e5ff" />
                <text x="${cx}" y="${y0 - 8}" fill="#05131d" font-size="9" font-weight="800" text-anchor="middle">★ 최적 융합</text>
            ` : '';

            groupsHtml += `
                ${highlightBox}
                <!-- R² Bar -->
                <rect x="${b1X.toFixed(1)}" y="${yR2.toFixed(1)}" width="${barW}" height="${hR2.toFixed(1)}" rx="3" fill="#00e5ff" opacity="0.9" />
                <text x="${(b1X + barW / 2).toFixed(1)}" y="${(yR2 - 4).toFixed(1)}" fill="#00e5ff" font-size="9" font-weight="700" text-anchor="middle" font-family="var(--font-mono)">${item.r2.toFixed(1)}</text>

                <!-- Accuracy (1-MAE) Bar -->
                <rect x="${b2X.toFixed(1)}" y="${yAcc.toFixed(1)}" width="${barW}" height="${hAcc.toFixed(1)}" rx="3" fill="#a855f7" opacity="0.9" />
                <text x="${(b2X + barW / 2).toFixed(1)}" y="${(yAcc - 4).toFixed(1)}" fill="#a855f7" font-size="9" font-weight="700" text-anchor="middle" font-family="var(--font-mono)">${item.acc.toFixed(1)}</text>

                <!-- Weight Bar -->
                <rect x="${b3X.toFixed(1)}" y="${yW.toFixed(1)}" width="${barW}" height="${hW.toFixed(1)}" rx="3" fill="#f97316" opacity="0.9" />
                <text x="${(b3X + barW / 2).toFixed(1)}" y="${(yW - 4).toFixed(1)}" fill="#f97316" font-size="9" font-weight="700" text-anchor="middle" font-family="var(--font-mono)">${item.isBest ? '운영' : item.weight.toFixed(0) + '%'}</text>

                <!-- X Label -->
                <text x="${cx.toFixed(1)}" y="${y0 + ph + 18}" fill="${item.isBest ? 'var(--text-accent)' : 'var(--text-secondary)'}" font-size="10" font-weight="${item.isBest ? '800' : '600'}" text-anchor="middle">${item.name}</text>
            `;
        });

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
                <!-- Y축 그리드선 -->
                <line x1="${x0}" y1="${y0 + ph * 0.25}" x2="${x0 + pw}" y2="${y0 + ph * 0.25}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <line x1="${x0}" y1="${y0 + ph * 0.5}" x2="${x0 + pw}" y2="${y0 + ph * 0.5}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <line x1="${x0}" y1="${y0 + ph * 0.75}" x2="${x0 + pw}" y2="${y0 + ph * 0.75}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <line x1="${x0}" y1="${y0 + ph}" x2="${x0 + pw}" y2="${y0 + ph}" stroke="rgba(255,255,255,0.2)" />

                <text x="${x0 - 8}" y="${y0 + ph * 0.25 + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" font-family="var(--font-mono)">75%</text>
                <text x="${x0 - 8}" y="${y0 + ph * 0.5 + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" font-family="var(--font-mono)">50%</text>
                <text x="${x0 - 8}" y="${y0 + ph * 0.75 + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" font-family="var(--font-mono)">25%</text>
                <text x="${x0 - 8}" y="${y0 + ph + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" font-family="var(--font-mono)">0%</text>

                ${groupsHtml}
            </svg>
        `;
    }

    // ==========================================================================
    // [공정변수 영향도 & 민감도 분석 종합 대시보드 4대 차트 구현]
    // ==========================================================================

    // [유형 A] 6대 공정 변수 다차원 레이더 차트 (SVG)
    function renderFeatureRadarChart() {
        const container = document.getElementById('featureRadarChartContainer');
        if (!container) return;

        const w = 480, h = 260, cx = 240, cy = 130, R = 85;
        const labels = ['온도 편차', '압력 편차', 'RF 전력', '진동 RMS', '가스 유량', '소비 전력'];
        const curVals = [86, 78, 64, 42, 35, 28]; // 현재 운전치 (0~100)
        const optVals = [45, 40, 48, 30, 30, 25]; // AI 권장 밴드 (0~100)

        // 5단계 다각형 동심 격자 (20%, 40%, 60%, 80%, 100%)
        let gridPolygons = '';
        [0.2, 0.4, 0.6, 0.8, 1.0].forEach(scale => {
            const r = R * scale;
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const th = -Math.PI / 2 + i * (Math.PI / 3);
                pts.push(`${(cx + Math.cos(th) * r).toFixed(1)},${(cy + Math.sin(th) * r).toFixed(1)}`);
            }
            gridPolygons += `
                <polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2" />
                <text x="${cx + 4}" y="${(cy - r + 8).toFixed(1)}" fill="var(--text-secondary)" font-size="8" font-family="var(--font-mono)">${(scale * 100).toFixed(0)}%</text>
            `;
        });

        // 6개 축선 및 라벨
        let axisLines = '';
        for (let i = 0; i < 6; i++) {
            const th = -Math.PI / 2 + i * (Math.PI / 3);
            const ax = cx + Math.cos(th) * R;
            const ay = cy + Math.sin(th) * R;
            const lx = cx + Math.cos(th) * (R + 18);
            const ly = cy + Math.sin(th) * (R + 18);

            axisLines += `
                <line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                <text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" fill="var(--text-accent)" font-size="10" font-weight="700" text-anchor="middle">${labels[i]}</text>
            `;
        }

        // 현재 운전치 폴리곤
        const curPts = [];
        let curDots = '';
        curVals.forEach((v, i) => {
            const th = -Math.PI / 2 + i * (Math.PI / 3);
            const r = R * (v / 100);
            const px = cx + Math.cos(th) * r;
            const py = cy + Math.sin(th) * r;
            curPts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
            curDots += `
                <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#00e5ff" stroke="#ffffff" stroke-width="1.5" />
                <text x="${px.toFixed(1)}" y="${(py - 6).toFixed(1)}" fill="#00e5ff" font-size="9" font-weight="800" font-family="var(--font-mono)" text-anchor="middle">${v}%</text>
            `;
        });

        // AI 권장 최적 밴드 폴리곤
        const optPts = [];
        optVals.forEach((v, i) => {
            const th = -Math.PI / 2 + i * (Math.PI / 3);
            const r = R * (v / 100);
            const px = cx + Math.cos(th) * r;
            const py = cy + Math.sin(th) * r;
            optPts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        });

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
                ${gridPolygons}
                ${axisLines}

                <!-- AI 권장 최적 밴드 (보라 점선) -->
                <polygon points="${optPts.join(' ')}" fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" stroke-width="1.8" stroke-dasharray="4,4" />

                <!-- 현재 계측 프로파일 (시안 발광) -->
                <polygon points="${curPts.join(' ')}" fill="rgba(0, 229, 255, 0.22)" stroke="#00e5ff" stroke-width="2.2" />
                ${curDots}
            </svg>
        `;
    }

    // [유형 B] SHAP 양방향 특성 기여도 워터폴 분기 차트 (SVG)
    function renderFeatureDivergingChart() {
        const container = document.getElementById('featureDivergingChartContainer');
        if (!container) return;

        const w = 480, h = 260, x0 = 230, y0 = 36, pw = 175, ph = 195;
        const maxImpact = 0.40;

        const items = [
            { name: '공정 온도 편차', val: 0.342, dir: 'pos', color: '#ef4444', desc: '과열 시 박막 급격한 두께 불균일 촉발' },
            { name: '챔버 압력 편차', val: 0.298, dir: 'pos', color: '#f97316', desc: '차압 불안정 시 식각 테이퍼 불량 촉발' },
            { name: 'RF 플라즈마 전력', val: 0.185, dir: 'pos', color: '#eab308', desc: '과출력 시 플라즈마 아킹 및 표면 데미지' },
            { name: '소비 전력 변동량', val: 0.039, dir: 'pos', color: '#94a3b8', desc: '공정 피크 부하 변동' },
            { name: '공정 가스 유량', val: -0.054, dir: 'neg', color: '#06b6d4', desc: '질량유량 정밀 제어 시 균일도 향상 기여' },
            { name: '설비 진동 RMS', val: -0.082, dir: 'neg', color: '#10b981', desc: '진동 댐핑 안정화 시 선폭(CD) 정밀도 개선' }
        ];

        const rowH = ph / items.length;
        let rowsHtml = '';

        items.forEach((item, idx) => {
            const by = y0 + idx * rowH + 4;
            const barHeight = 16;
            const barLen = (Math.abs(item.val) / maxImpact) * pw;

            if (item.dir === 'pos') {
                rowsHtml += `
                    <!-- 우측 막대 (양의 영향: 불량 촉발) -->
                    <text x="${x0 - 10}" y="${by + 12}" fill="var(--text-primary)" font-size="11" font-weight="600" text-anchor="end">${item.name}</text>
                    <rect x="${x0}" y="${by}" width="${barLen.toFixed(1)}" height="${barHeight}" rx="3" fill="${item.color}" opacity="0.9" />
                    <text x="${(x0 + barLen + 6).toFixed(1)}" y="${by + 12}" fill="${item.color}" font-size="10" font-weight="700" font-family="var(--font-mono)">+${item.val.toFixed(3)}</text>
                `;
            } else {
                rowsHtml += `
                    <!-- 좌측 막대 (음의 영향: 안정화 기여) -->
                    <text x="${x0 + 10}" y="${by + 12}" fill="var(--text-primary)" font-size="11" font-weight="600" text-anchor="start">${item.name}</text>
                    <rect x="${(x0 - barLen).toFixed(1)}" y="${by}" width="${barLen.toFixed(1)}" height="${barHeight}" rx="3" fill="${item.color}" opacity="0.9" />
                    <text x="${(x0 - barLen - 6).toFixed(1)}" y="${by + 12}" fill="${item.color}" font-size="10" font-weight="700" font-family="var(--font-mono)" text-anchor="end">${item.val.toFixed(3)}</text>
                `;
            }
        });

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
                <!-- 상단 방향 지시 헤더 -->
                <text x="${x0 - 90}" y="20" fill="#00e5ff" font-size="10" font-weight="700" text-anchor="middle">◀ 공정 안정화 기여 (-)</text>
                <text x="${x0 + 90}" y="20" fill="#ef4444" font-size="10" font-weight="700" text-anchor="middle">불량 위험 촉발 (+) ▶</text>

                <!-- 좌우 그리드 가이드라인 -->
                <line x1="${x0 - pw * 0.5}" y1="${y0}" x2="${x0 - pw * 0.5}" y2="${y0 + ph}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <line x1="${x0 + pw * 0.5}" y1="${y0}" x2="${x0 + pw * 0.5}" y2="${y0 + ph}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />
                <line x1="${x0 + pw}" y1="${y0}" x2="${x0 + pw}" y2="${y0 + ph}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2" />

                <!-- 0점 중심 분기선 -->
                <line x1="${x0}" y1="${y0 - 8}" x2="${x0}" y2="${y0 + ph + 8}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
                <text x="${x0}" y="${y0 + ph + 18}" fill="var(--text-secondary)" font-size="9" text-anchor="middle" font-family="var(--font-mono)">0.0 (영향 기준점)</text>

                ${rowsHtml}
            </svg>
        `;
    }

    // [유형 C] 6x6 공정 인자 간 상호작용 상관 매트릭스 히트맵 (SVG)
    function renderFeatureHeatmapChart() {
        const container = document.getElementById('featureHeatmapChartContainer');
        if (!container) return;

        const w = 480, h = 260, x0 = 80, y0 = 36, cellSize = 30, gap = 2;
        const labels = ['온도', '압력', 'RF전력', '진동', '가스', '전력'];
        const matrix = [
            [1.00,  0.72,  0.58,  0.24,  0.31,  0.42],
            [0.72,  1.00,  0.46,  0.18,  0.64,  0.35],
            [0.58,  0.46,  1.00,  0.41,  0.28,  0.84],
            [0.24,  0.18,  0.41,  1.00, -0.12,  0.33],
            [0.31,  0.64,  0.28, -0.12,  1.00,  0.21],
            [0.42,  0.35,  0.84,  0.33,  0.21,  1.00]
        ];

        let cellsHtml = '';
        // 컬럼 헤더 라벨
        labels.forEach((lb, j) => {
            const hx = x0 + j * (cellSize + gap) + cellSize / 2;
            cellsHtml += `<text x="${hx.toFixed(1)}" y="${y0 - 8}" fill="var(--text-accent)" font-size="10" font-weight="700" text-anchor="middle">${lb}</text>`;
        });

        // 행 및 셀 렌더링
        matrix.forEach((row, i) => {
            const ry = y0 + i * (cellSize + gap);
            // 행 라벨
            cellsHtml += `<text x="${x0 - 8}" y="${(ry + cellSize / 2 + 4).toFixed(1)}" fill="var(--text-accent)" font-size="10" font-weight="700" text-anchor="end">${labels[i]}</text>`;

            row.forEach((val, j) => {
                const rx = x0 + j * (cellSize + gap);
                let bg, textColor = '#fff';

                if (i === j) {
                    bg = 'rgba(0, 229, 255, 0.45)';
                } else if (val >= 0.70) {
                    bg = 'rgba(236, 72, 153, 0.65)'; // 강한 상호작용 하이라이트!
                } else if (val >= 0.45) {
                    bg = 'rgba(2, 132, 199, 0.45)';
                } else if (val >= 0.15) {
                    bg = 'rgba(51, 65, 85, 0.6)';
                    textColor = 'var(--text-secondary)';
                } else {
                    bg = 'rgba(124, 58, 237, 0.35)'; // 음의 상관
                }

                const isHighlight = (i === 0 && j === 1) || (i === 1 && j === 0) || (i === 2 && j === 5) || (i === 5 && j === 2);
                const strokeAttr = isHighlight ? 'stroke="#ec4899" stroke-width="1.8"' : 'stroke="rgba(255,255,255,0.05)" stroke-width="0.5"';

                cellsHtml += `
                    <rect x="${rx}" y="${ry}" width="${cellSize}" height="${cellSize}" rx="4" fill="${bg}" ${strokeAttr} />
                    <text x="${rx + cellSize / 2}" y="${ry + cellSize / 2 + 4}" fill="${textColor}" font-size="9" font-weight="${isHighlight ? '800' : '600'}" font-family="var(--font-mono)" text-anchor="middle">${val.toFixed(2)}</text>
                `;
            });
        });

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
                ${cellsHtml}

                <!-- 우측 상호작용 설명 박스 -->
                <g transform="translate(290, 42)">
                    <rect x="0" y="0" width="180" height="70" rx="6" fill="rgba(236, 72, 153, 0.12)" stroke="#ec4899" stroke-width="1" />
                    <text x="10" y="20" fill="#f472b6" font-size="11" font-weight="800">🔥 핵심 상호작용 (CCP)</text>
                    <text x="10" y="38" fill="var(--text-primary)" font-size="10">• 온도 x 압력 (+0.72 강연동)</text>
                    <text x="10" y="54" fill="var(--text-secondary)" font-size="10">• RF전력 x 소비전력 (+0.84)</text>
                </g>

                <g transform="translate(290, 126)">
                    <rect x="0" y="0" width="180" height="95" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1" />
                    <text x="10" y="20" fill="var(--text-accent)" font-size="10" font-weight="700">💡 엔지니어링 해석 요약</text>
                    <text x="10" y="38" fill="var(--text-secondary)" font-size="9">온도 상승 시 챔버 열팽창으로</text>
                    <text x="10" y="52" fill="var(--text-secondary)" font-size="9">압력이 동반 급등하여 두 인자가</text>
                    <text x="10" y="66" fill="var(--text-secondary)" font-size="9">품질 편차의 64%를 시너지 유발</text>
                    <text x="10" y="82" fill="#00e5ff" font-size="9" font-weight="700">➔ 다변량 동시 제어(MPC) 필수</text>
                </g>
            </svg>
        `;
    }

    // [유형 D] 핵심 4대 인자 안전 운전 마진 & 공정 능력 (Cpk) 스피도미터 게이지 (SVG)
    function renderFeatureGauges() {
        const container = document.getElementById('featureGaugesContainer');
        if (!container) return;

        const w = 480, h = 260;
        const dials = [
            { name: '공정 온도 편차', val: '401.5 °C', delta: '+1.5°C 편차', cpk: '1.33', grade: '4σ 우수', pct: 68, cx: 120, cy: 72 },
            { name: '챔버 압력 편차', val: '2.52 mTorr', delta: '+2.5% 초과', cpk: '1.18', grade: '주의 관찰', pct: 78, cx: 360, cy: 72 },
            { name: 'RF 플라즈마 전력', val: '2,515 W', delta: '+15W 편차', cpk: '1.45', grade: '최우수 안착', pct: 45, cx: 120, cy: 190 },
            { name: '설비 진동 RMS', val: '0.038 g', delta: '정상범위 유지', cpk: '1.25', grade: '양호 관리', pct: 52, cx: 360, cy: 190 }
        ];

        let gaugesHtml = '';
        dials.forEach(d => {
            const R = 42;
            // 각도: -Math.PI(180도, 좌)에서 0(360도, 우)까지
            const needleAngle = -Math.PI + (d.pct / 100) * Math.PI;
            const nx = d.cx + Math.cos(needleAngle) * (R - 8);
            const ny = d.cy + Math.sin(needleAngle) * (R - 8);

            const isWarn = d.pct > 75;

            gaugesHtml += `
                <!-- 반원 게이지 트랙 -->
                <!-- 녹색 안전 구간 (0~60%) -->
                <path d="M ${d.cx - R} ${d.cy} A ${R} ${R} 0 0 1 ${(d.cx + Math.cos(-Math.PI * 0.4) * R).toFixed(1)} ${(d.cy + Math.sin(-Math.PI * 0.4) * R).toFixed(1)}" fill="none" stroke="#10b981" stroke-width="6" opacity="0.8" />
                <!-- 황색 주의 구간 (60~85%) -->
                <path d="M ${(d.cx + Math.cos(-Math.PI * 0.4) * R).toFixed(1)} ${(d.cy + Math.sin(-Math.PI * 0.4) * R).toFixed(1)} A ${R} ${R} 0 0 1 ${(d.cx + Math.cos(-Math.PI * 0.15) * R).toFixed(1)} ${(d.cy + Math.sin(-Math.PI * 0.15) * R).toFixed(1)}" fill="none" stroke="#f59e0b" stroke-width="6" opacity="0.8" />
                <!-- 적색 위험 구간 (85~100%) -->
                <path d="M ${(d.cx + Math.cos(-Math.PI * 0.15) * R).toFixed(1)} ${(d.cy + Math.sin(-Math.PI * 0.15) * R).toFixed(1)} A ${R} ${R} 0 0 1 ${d.cx + R} ${d.cy}" fill="none" stroke="#ef4444" stroke-width="6" opacity="0.8" />

                <!-- 지침 바늘 (Needle) -->
                <line x1="${d.cx}" y1="${d.cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${isWarn ? '#ef4444' : '#00e5ff'}" stroke-width="2.5" stroke-linecap="round" />
                <circle cx="${d.cx}" cy="${d.cy}" r="4.5" fill="#ffffff" stroke="#05131d" stroke-width="1.5" />

                <!-- 텍스트 정보 -->
                <text x="${d.cx}" y="${d.cy + 16}" fill="var(--text-primary)" font-size="11" font-weight="700" text-anchor="middle">${d.name}</text>
                <text x="${d.cx}" y="${d.cy + 30}" fill="${isWarn ? 'var(--color-review)' : 'var(--text-accent)'}" font-size="12" font-weight="800" font-family="var(--font-mono)" text-anchor="middle">${d.val}</text>
                
                <!-- Cpk 배지 -->
                <g transform="translate(${d.cx - 45}, ${d.cy + 34})">
                    <rect x="0" y="0" width="90" height="15" rx="7.5" fill="${isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 229, 255, 0.15)'}" stroke="${isWarn ? '#f59e0b' : '#00e5ff'}" stroke-width="0.8" />
                    <text x="45" y="11" fill="${isWarn ? '#f59e0b' : '#00e5ff'}" font-size="9" font-weight="800" font-family="var(--font-mono)" text-anchor="middle">Cpk ${d.cpk} (${d.grade})</text>
                </g>
            `;
        });

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
                ${gaugesHtml}
            </svg>
        `;
    }

    // [하단] 선택 변수 정밀 진단 & 엔지니어링 조치 인터랙티브 패널
    const featureDetailProfiles = [
        {
            name: '공정 온도 편차 (Temperature Deviation)',
            rank: '1위 핵심 통제점 (CCP)',
            importance: '34.2%',
            sensor: '고정밀 백금 측온저항체 (Pt100 RTD 4선식) · 표면파 통신 10ms 주기',
            window: '목표 400.0 °C (허용 관리 공차: ±1.5 °C)',
            cpk: '1.33 (4-Sigma 공정 능력 지수 확보)',
            physics: '온도 과열 시 증착 전구체 가스의 열분해 반응 속도가 4.2% 급증하여 박막 결정립 크기 불균일 및 산화막 두께 편차를 직접 촉발합니다.',
            actions: [
                '냉각수 순환 바이패스 밸브(V-102) 개도율을 45%에서 50%로 미세 상향 조정',
                '챔버 3존 멀티채널 히터의 PID 피드백 게인 중 비례대(P-gain) 5% 하향 보정',
                '열화상 적외선 스캔을 통한 챔버 외벽 핫스팟(Hot-spot) 유무 확인'
            ]
        },
        {
            name: '챔버 진공 압력 편차 (Chamber Pressure Deviation)',
            rank: '2위 핵심 통제점 (CCP)',
            importance: '29.8%',
            sensor: '정전용량식 다이어프램 게이지 (Capacitance Manometer) · 0.1 mTorr 분해능',
            window: '목표 2.50 mTorr (허용 관리 공차: ±0.05 mTorr)',
            cpk: '1.18 (주의 관찰 필요 레벨)',
            physics: '진공 차압 변동 시 플라즈마 시스(Sheath) 두께가 진동하여 웨이퍼 입사 이온의 직진 궤적이 왜곡되며, 식각 단차 테이퍼 각도 불량을 유발합니다.',
            actions: [
                '진공 드로틀 밸브(Pendulum Valve) 서보 모터 엔코더 영점 캘리브레이션',
                '하부 드라이 진공 펌프 배기 라인 파티클 트랩 오염도 점검 및 질소 퍼지',
                '게이트 밸브 밀폐용 불소 고무(Viton) O링 미세 리크(Leak) He 디텍터 측정'
            ]
        },
        {
            name: 'RF 플라즈마 전력 (RF Plasma Power)',
            rank: '3위 에너지 인자',
            importance: '18.5%',
            sensor: '고주파 13.56 MHz VI 프로브 및 매칭 박스 반사파 디텍터',
            window: '목표 2,500 W (허용 관리 공차: ±25 W)',
            cpk: '1.45 (최우수 제어 수준)',
            physics: 'RF 전력 불균형 시 전극 에지부에 전계가 집중되어 플라즈마 아킹(Arcing)이 발생하며, 기판 표면의 미세 소자 파괴 위험이 증가합니다.',
            actions: [
                'RF 매칭 박스 자동 가변 콘덴서(VC1/VC2) 튜닝 모터 응답 속도 확인',
                'RF 전송 동축 케이블 커넥터 접촉 저항 및 절연 내압 측정',
                '플라즈마 방전 전극 표면 폴리머 잔류물 드라이아이스 세정'
            ]
        },
        {
            name: '설비 진동 실효치 (Vibration RMS)',
            rank: '4위 기계적 열화 인자',
            importance: '8.2%',
            sensor: '3축 초소형 피에조 가속도 진동 센서 (0~10 kHz 고주파 대역)',
            window: '정상 기준: 0.050 g 이하 (현재 실측치: 0.038 g)',
            cpk: '1.25 (양호 관리 수준)',
            physics: '터보 펌프 및 웨이퍼 이송 로봇 베어링 진동이 챔버로 전달될 경우 노광 스캐너의 정밀 포토 레지스트 선폭(CD) 임계 치수에 미세 지터(Jitter)가 발생합니다.',
            actions: [
                '터보 분자 펌프(TMP) 마그네틱 베어링 1X/2X 고조파 진동 스펙트럼 분석',
                '설비 챔버 마운트 에어 스프링 제진대(Pneumatic Damper) 압력 점검',
                '베어링 윤활 그리스 교체 주기 및 고착 여부 확인'
            ]
        }
    ];

    function selectFeatureForDetail(idx) {
        const card = document.getElementById('featureDetailCard');
        if (!card) return;

        const p = featureDetailProfiles[idx] || featureDetailProfiles[0];
        card.innerHTML = `
            <div class="feature-detail-header">
                <div>
                    <span class="context-tag" style="background:var(--bus-sensor); color:#05131d; font-weight:800; border:none; margin-right:8px;">${p.rank}</span>
                    <strong style="font-size:15px; color:var(--text-primary);">${p.name}</strong>
                    <span style="font-size:12px; color:var(--text-accent); margin-left:8px; font-weight:700;">중요도 기여율: ${p.importance}</span>
                </div>
                <span class="kpi-delta good" style="font-size:11px;">실시간 센서 텔레메트리 연동 중</span>
            </div>

            <!-- 파라미터 4대 핵심 사양 그리드 -->
            <div class="feature-detail-param-grid">
                <div class="param-box">
                    <div class="param-key">계측 센서 및 통신 버스</div>
                    <div class="param-val" style="font-size:12px;">${p.sensor}</div>
                </div>
                <div class="param-box">
                    <div class="param-key">허용 관리 공차 윈도우</div>
                    <div class="param-val" style="font-size:12px; color:var(--text-accent);">${p.window}</div>
                </div>
                <div class="param-box">
                    <div class="param-key">공정 능력 지수 (Cpk)</div>
                    <div class="param-val" style="font-size:12px; color:var(--color-normal);">${p.cpk}</div>
                </div>
                <div class="param-box">
                    <div class="param-key">품질 영향도 분석</div>
                    <div class="param-val" style="font-size:12px;">${p.physics.slice(0, 32)}...</div>
                </div>
            </div>

            <!-- 불량 유발 메커니즘 및 엔지니어링 조치 -->
            <div style="background:var(--bg-base); padding:10px 12px; border-radius:6px; border:1px solid var(--border-color); font-size:12px;">
                <div style="color:var(--text-accent); font-weight:700; margin-bottom:4px;">🔬 불량 발생 물리적 메커니즘:</div>
                <div style="color:var(--text-secondary); line-height:1.5; margin-bottom:8px;">${p.physics}</div>
                <div style="color:var(--bus-sensor); font-weight:700; margin-bottom:4px;">🛠️ 권고 엔지니어링 즉시 조치 사항:</div>
                <ul style="margin:0; padding-left:18px; color:var(--text-primary); line-height:1.6;">
                    ${p.actions.map(a => `<li>${a}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    window.selectFeatureForDetail = selectFeatureForDetail;

    // 툴팁 노출 및 숨김 함수
    function showScatterTooltip(e, text) {
        const tip = document.getElementById('labChartTooltip');
        if (!tip) return;
        tip.innerText = text;
        tip.style.display = 'block';
        const rect = tip.parentElement.getBoundingClientRect();
        let left = e.clientX - rect.left + 15;
        let top = e.clientY - rect.top + 10;
        if (left + 240 > rect.width) left = left - 260;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    function hideScatterTooltip() {
        const tip = document.getElementById('labChartTooltip');
        if (tip) tip.style.display = 'none';
    }

    // 8-2. 사용자 역할별 심층 분석 리뷰 & 인사이트 스튜디오 (Role-Tailored Deep Insight Studio)
    const roleInsightsData = {
        operator: {
            roleName: '현장 작업자 (Operator)',
            icon: '👷',
            tagline: '직관적 신호등 상태 파악 및 즉각적인 설비 조작 행동 수칙',
            statusLevel: 'review',
            statusText: '주의 관찰 필요 (🟡 Yellow Alert)',
            confidenceScore: '94.2% AI 신뢰도',
            kpis: [
                { label: '챔버 내부 온도', val: '401.5 °C', delta: '+1.5°C 편차', status: 'warn' },
                { label: '챔버 진공 압력', val: '2.52 mTorr', delta: '+2.5% 초과', status: 'warn' },
                { label: '품질 위험 지수', val: '0.28 (안정)', delta: '허용치(±1.0) 이내', status: 'good' },
                { label: '다음 로트 대기', val: '4분 12초', delta: '웨이퍼 투입 대기', status: 'good' }
            ],
            fourSentences: {
                p1: '지금 3번 PECVD 플라즈마 증착 챔버의 내부 온도가 기준(400°C)보다 1.5°C 높고 내부 압력이 2.5% 미세 상승했습니다.',
                p2: '이 상태가 15분 이상 지속되면 박막 증착 두께의 균일도가 떨어져 다음 5단계 식각 공정에서 품질 이탈이 발생할 위험이 있습니다.',
                p3: '냉각수 바이패스 밸브(V-102) 개도율을 확인하고, 차압 게이지 지침이 2.8 mTorr를 넘지 않는지 5분 간격으로 확인하십시오.',
                p4: '현재 현상이 센서 교정 오차인지 실제 배관 누설인지 여부는 설비 정비원의 진공 리크 체크 전까지 확정되지 않았습니다.'
            },
            actions: [
                { priority: 'P0', title: '냉각수 유량 밸브 V-102 개도율 50% 유지 점검', desc: '챔버 온도 400°C 안정화 확인 후 다음 로트 투입 진행' },
                { priority: 'P1', title: '챔버 도어 진공 O링 씰 이물질 육안 점검', desc: '도어 개폐 시 파티클 카운터 지침이 0.05 개/cm² 이하인지 확인' },
                { priority: 'P2', title: '이상 지속 시 인터콤으로 설비보전반 긴급 무전 호출', desc: '연속 2회 규격 이탈 판정 시 즉시 인터록(Interlock) 일시정지 조치' }
            ],
            toolAction: { label: '🔧 설비 이상 점검 작업 즉시 발행', target: 'tasks' }
        },
        maintenance: {
            roleName: '설비 정비원 (Maintenance Technician)',
            icon: '🔧',
            tagline: '예방보전(PM) 주기 예측, 부품 마모도 진단 및 표준행동절차(SOP) 연계',
            statusLevel: 'review',
            statusText: '정비 검토 권고 (P1 Maintenance)',
            confidenceScore: '92.8% 부품 수명 예측',
            kpis: [
                { label: 'RF 매칭 임피던스', val: '0.45 σ', delta: '정합 불균형 관측', status: 'warn' },
                { label: '진동 실효치 (RMS)', val: '0.038 g', delta: '정상 한계(0.05g) 이내', status: 'good' },
                { label: '방전 코일 열화도', val: '85.2 %', delta: '교체 권고치(85%) 도달', status: 'warn' },
                { label: '예방정비(PM) 주기', val: 'D-3일', delta: '3일 조기 실시 권고', status: 'good' }
            ],
            fourSentences: {
                p1: '5번 ICP 플라즈마 식각기의 RF 제너레이터 매칭 박스에서 임피던스 반사파 편차가 0.45σ로 상승했습니다.',
                p2: 'RF 전력 전달 효율이 저하되면 플라즈마 밀도가 불균일해져 식각 깊이 편차(현재 221.8nm, 목표 220nm)가 커집니다.',
                p3: '방전 코일 열화 누적치(85.2%)를 감안하여 3일 후 예정된 정기 PM을 1일 앞당겨 가스켓과 코일을 동시 교체하십시오.',
                p4: '임피던스 편차가 매칭 박스 가변 캐패시터 모터의 기계적 마모 때문인지 RF 케이블 열화 때문인지는 분해 측정 전까지 미확인 상태입니다.'
            },
            actions: [
                { priority: 'P0', title: 'RF 매칭부 진공 가변 콘덴서(VC1/VC2) 용량 실측', desc: '반사파 전력(Reflected Power)이 입사파의 2% 이하인지 오실로스코프 확인' },
                { priority: 'P1', title: '표준 정비 키트(Part No. RF-COIL-440) 자재실 불출 요청', desc: '사전 승인된 예비 정품 파트 확보 후 클린룸 정비실 대기' },
                { priority: 'P2', title: '표준행동절차 SOP-04 준수 하에 챔버 드라이아이스 클리닝', desc: '절연 가스켓 교체 후 He 리크 디텍터로 진공도 1.0e-6 Torr 확인' }
            ],
            toolAction: { label: '🛠️ [SOP-04] RF 매칭부 정비 작업 원장 등록', target: 'tasks' }
        },
        manager: {
            roleName: '생산 관리자 (Production Manager)',
            icon: '👤',
            tagline: '라인 종합 효율(OEE), 공정 간 병목 정체(Queue Time) 해소 및 일일 납기 관리',
            statusLevel: 'normal',
            statusText: '라인 종합 수율 97.8% (안정 유지)',
            confidenceScore: '96.5% 납기 준수율',
            kpis: [
                { label: '공정 간 대기시간', val: '13.8 분', delta: '목표(12분) 대비 +1.8분', status: 'warn' },
                { label: '규격 이탈률', val: '2.2 %', delta: '전일 대비 -0.3%p (개선)', status: 'good' },
                { label: '라인 가동률 (OEE)', val: '91.4 %', delta: '월간 목표(90%) 초과 달성', status: 'good' },
                { label: '불량 리스크 로트', val: '1 건 (격리)', delta: 'Lot #20270101-04', status: 'warn' }
            ],
            fourSentences: {
                p1: '1~5단계 전공정 품질 지표는 안정적이나, 식각에서 이온주입으로 넘어가는 공정 대기시간이 평균 13.8분으로 지연 중입니다.',
                p2: '대기시간 정체 방치 시 후공정 CMP 및 패키징 설비의 유휴 대기(Idle)가 발생하여 일일 생산량이 4.5% 감소할 수 있습니다.',
                p3: '오후 2교대 투입 로트를 시간당 4개로 균등 배분하고, AI 주의 판정 로트 1건을 사전 선별하여 검사 레인으로 우회하십시오.',
                p4: '원자재(가스 튜브/웨이퍼 인곳) 로트 간 물성 편차로 인한 식각 속도 미세 변동 원인은 자재 입고 성적서 대조 전까지 조사 중입니다.'
            },
            actions: [
                { priority: 'P0', title: '공정 대기시간 병목 완화를 위한 로트 투입 간격 15분 재조정', desc: '5단계 식각 완료 버퍼(Foup Stocker) 체류 시간 12분 이하 단축' },
                { priority: 'P1', title: 'AI 예측 주의 로트(#20270101-04) 후공정 직투입 차단 및 중간 ATE 배정', desc: '불량 웨이퍼 패키징 투입 사전 방지로 재작업 손실 1,280만 원 회피' },
                { priority: 'P2', title: '일일 생산 회의 안건 등록: 3번/5번 설비 예방보전 일정 확정', desc: '야간 비가동 시간대(23:00~02:00) 활용하여 정비 스케줄 조율' }
            ],
            toolAction: { label: '📄 생산 관리 일일 보고서 자동 생성', target: 'reports' }
        },
        engineer: {
            roleName: '공정 기술원 / AI 엔지니어 (Process & AI Specialist)',
            icon: '🔬',
            tagline: '통계적 잔차 분석, 다변량 공정 제어(MPC), 특성 민감도 및 모델 드리프트 모니터링',
            statusLevel: 'normal',
            statusText: '모델 안정성 우수 (R² 0.6036, MAE 0.3018)',
            confidenceScore: 'p-value < 0.001 (통계적 유의)',
            kpis: [
                { label: '결정계수 (R²)', val: '0.6036', delta: '단일트리 대비 +1.4%p', status: 'good' },
                { label: '잔차 왜도 (Skew)', val: '0.041', delta: '정규분포 완벽 부합', status: 'good' },
                { label: 'Durbin-Watson', val: '1.982', delta: '잔차 자기상관 없음', status: 'good' },
                { label: '모델 추론 레이턴시', val: '8.2 ms', delta: '실시간 제어(50ms) 여유', status: 'good' }
            ],
            fourSentences: {
                p1: '가중 앙상블 모델의 1,000건 독립 테스트셋 검증 결과 MAE 0.3018, RMSE 0.3816으로 오차 한계(±1.0) 내에 안착했습니다.',
                p2: 'SHAP 분석 결과, 온도 편차(34.2%)와 압력 편차(29.8%)의 교호작용(Interaction)이 전체 품질 분산의 64.0%를 주도합니다.',
                p3: '온도-압력 2차원 반응 표면을 기반으로 레시피 허용 윈도우(Tolerance Box)를 현재 ±2.5%에서 ±1.5%로 축소 권고합니다.',
                p4: '외기 계절 변화(동절기/하절기)에 따른 챔버 외벽 열팽창 드리프트 보정 계수는 3개월 추가 시계열 데이터 수집 후 검증 예정입니다.'
            },
            actions: [
                { priority: 'P0', title: '온도·압력 다변량 상관 제어(MPC) 알고리즘 PLC 피드백 연동', desc: '설비 단독 PID 제어에서 상위 AI 오프셋 실시간 보정 루프로 고도화' },
                { priority: 'P1', title: '분기별 AI 모델 드리프트 재학습 트리거 기준 확립 (RMSE > 0.42)', desc: '10,000행 합성원장 제2판에서 신규 현장 실측치 누적 전이학습(Fine-tuning) 설계' },
                { priority: 'P2', title: '운전조건 시뮬레이터 파라미터 최적화 결과 레시피 매니저에 등록', desc: '가상 변경 시뮬레이션 기반 전력 소비 0.5 kWh 절감 레시피 배포' }
            ],
            toolAction: { label: '⚡ 운전조건 가상 시뮬레이션 최적화 열기', target: 'scenario' }
        },
        clevel: {
            roleName: '경영진 (C-Level Executive)',
            icon: '💼',
            tagline: '투자 대비 효과(ROI), 연간 품질 손실 회피액 및 ESG 탄소 배출 저감 성과',
            statusLevel: 'normal',
            statusText: '연간 경제적 효과 4.8억 원 창출',
            confidenceScore: '7.4개월 투자회수(Payback)',
            kpis: [
                { label: '연간 품질손실 회피', val: '4억 8천만 원', delta: '불량률 0.3%p 저감', status: 'good' },
                { label: '다운타임 예방 시간', val: '14.8 시간', delta: '불시 셧다운 방지', status: 'good' },
                { label: 'ESG 전력 절감량', val: '28,400 kWh', delta: '탄소 13.2톤 감축', status: 'good' },
                { label: '투자 회수 기간', val: '7.4 개월', delta: '2027년 하반기 전사 확대', status: 'good' }
            ],
            fourSentences: {
                p1: '써니웨이브텍 금속 표면파 통신 기반 AI 예지보전 도입으로 연간 품질 규격 이탈률이 2.5%에서 2.2%로 0.3%p 개선되었습니다.',
                p2: '설비 고장 사전 예측을 통해 연간 14.8시간의 라인 불시 정지를 방지하여 웨이퍼 폐기 및 리워크 비용 손실을 원천 차단했습니다.',
                p3: '현재 1개 라인 실증 성과를 바탕으로 2027년 3분기 아산 제2공장 및 후공정 패키징 라인 전사 확대를 승인하십시오.',
                p4: '원자재 국제 시세 변동 및 전력 단가 인상에 따른 연간 순절감액의 변동 범위는 상반기 결산 감사 후 최종 확정됩니다.'
            },
            actions: [
                { priority: 'P0', title: '2027년 스마트제조 2단계 확대 예산(금속 표면파 통신망 구축) 승인', desc: '평택 제1공장 잔여 라인 및 아산 OLED 라인 20개 공정으로 예지보전 플랫폼 확장' },
                { priority: 'P1', title: 'ESG 지속가능경영 보고서에 연간 탄소 13.2톤 감축 실적 공시 반영', desc: '산업통상자원부 스마트그린산단 에너지 효율화 우수 사례 출품' },
                { priority: 'P2', title: '써니웨이브텍-협력사 간 현장 운영 성과 인센티브 분배안 검토', desc: '수율 개선 기여도에 따른 현장 조업 엔지니어 성과 보상 연계' }
            ],
            toolAction: { label: '📄 경영진용 종합 의사결정 보고서 인쇄', target: 'reports' }
        }
    };

    function renderRoleInsightStudio(targetRole) {
        const container = document.getElementById('roleDeepDiveContainer');
        if (!container) return;

        const roleKey = roleInsightsData[targetRole] ? targetRole : 'manager';
        const data = roleInsightsData[roleKey];

        // 필 탭 상태 갱신
        document.querySelectorAll('.role-insight-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === roleKey);
        });

        const tagEl = document.getElementById('currentRoleInsightTag');
        if (tagEl) {
            tagEl.innerText = `현재 관점: ${data.icon} ${data.roleName}`;
        }

        // 4대 KPI 스트립 생성
        const kpiHtml = data.kpis.map(k => `
            <div class="kpi-card" style="padding:10px 12px;">
                <div class="kpi-meta">
                    <div class="kpi-label" style="font-size:11px;">${k.label}</div>
                    <div class="kpi-val" style="font-size:16px;">${k.val}</div>
                </div>
                <span class="kpi-delta ${k.status}">${k.delta}</span>
            </div>
        `).join('');

        // 우선순위 체크리스트 생성
        const actionsHtml = data.actions.map(act => `
            <div class="checklist-item ${act.priority.toLowerCase()}">
                <span class="priority-badge ${act.priority.toLowerCase()}">${act.priority}</span>
                <div class="checklist-content">
                    <div class="checklist-title">${act.title}</div>
                    <div class="checklist-desc">${act.desc}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="role-deep-dive-card">
                <!-- 헤더 배너 -->
                <div class="role-header-banner">
                    <div class="role-header-title-wrap">
                        <span style="font-size:28px;">${data.icon}</span>
                        <div>
                            <div class="role-header-title">${data.roleName} 심층 진단 리포트</div>
                            <div class="role-header-sub">${data.tagline}</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="kpi-delta ${data.statusLevel === 'normal' ? 'good' : 'warn'}" style="font-size:11px; padding:4px 8px;">${data.statusText}</span>
                        <span style="font-size:11px; color:var(--text-accent); font-weight:700;">${data.confidenceScore}</span>
                    </div>
                </div>

                <!-- 핵심 모니터링 KPI 스트립 -->
                <div class="role-kpi-summary-bar">
                    ${kpiHtml}
                </div>

                <!-- 비전문가를 위한 쉬운 4문장 구조 해석 -->
                <div>
                    <div style="font-size:13px; font-weight:700; color:var(--text-accent); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>💡 비전문가를 위한 4문장 실무 해석 (현상 → 영향 → 조치 → 한계)</span>
                        <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">쉬운 설명 프레임워크</span>
                    </div>
                    <div class="easy-explain-grid">
                        <div class="explain-box">
                            <span class="step-tag">1단계. 지금 무슨 일이 보이는가</span>
                            <div class="explain-text">${data.fourSentences.p1}</div>
                        </div>
                        <div class="explain-box">
                            <span class="step-tag">2단계. 왜 즉시 확인해야 하는가</span>
                            <div class="explain-text">${data.fourSentences.p2}</div>
                        </div>
                        <div class="explain-box">
                            <span class="step-tag">3단계. 구체적으로 무엇을 할 수 있는가</span>
                            <div class="explain-text">${data.fourSentences.p3}</div>
                        </div>
                        <div class="explain-box">
                            <span class="step-tag">4단계. 아직 모르는 것은 무엇인가</span>
                            <div class="explain-text">${data.fourSentences.p4}</div>
                        </div>
                    </div>
                </div>

                <!-- 우선순위별 조치 권고 체크리스트 -->
                <div>
                    <div style="font-size:13px; font-weight:700; color:var(--text-accent); margin-bottom:8px;">
                        📋 역할별 표준 행동 지침 및 조치 권고 체크리스트
                    </div>
                    <div class="role-checklist-container">
                        ${actionsHtml}
                    </div>
                </div>

                <!-- 역할 특화 도구 연계 버튼 -->
                <div class="role-action-link-bar">
                    <button id="roleToolActionBtn" class="tool-btn" style="background:var(--bus-sensor); color:#05131d; font-weight:800; border:none; padding:8px 16px;">
                        ${data.toolAction.label} ➔
                    </button>
                </div>
            </div>
        `;

        // 액션 버튼 이벤트 연동
        const actionBtn = document.getElementById('roleToolActionBtn');
        if (actionBtn) {
            actionBtn.addEventListener('click', () => {
                const target = data.toolAction.target;
                if (target === 'tasks' || target === 'reports') {
                    state.activeWorkspace = target;
                    document.querySelectorAll('.nav-tab-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.workspace === target);
                    });
                    renderWorkspace();
                } else if (target === 'scenario') {
                    state.labActiveTab = 'scenario';
                    document.querySelectorAll('.lab-nav-item').forEach(i => {
                        i.classList.toggle('active', i.dataset.tab === 'scenario');
                    });
                    document.querySelectorAll('.lab-panel').forEach(p => p.classList.remove('active'));
                    const p = document.getElementById('labPanel_scenario');
                    if (p) p.classList.add('active');
                }
            });
        }
    }

    function renderLabExplainSection() {
        renderRoleInsightStudio(state.role || 'manager');
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

    // ==========================================================================
    // 9. 정비 협업 및 현장 SOP: 지식그래프 관제 대시보드 및 라이프사이클 엔진
    // ==========================================================================

    // 지식그래프 21개 노드 정의
    const kgNodes = [
        // 1. 설비 (EQ)
        { id: 'eq-pecvd', label: 'PECVD 플라즈마 증착기', cat: 'EQ', icon: '🏭', desc: '웨이퍼 표면에 절연막(SiO₂/Si₃N₄)을 고온 플라즈마로 증착하는 핵심 공정 설비', x: 90, y: 70, color: '#38bdf8' },
        { id: 'eq-icp', label: 'ICP 고밀도 식각기', cat: 'EQ', icon: '⚡', desc: '수십 나노미터 급 초미세 회로 패턴 형성을 위한 건식 식각 챔버 설비', x: 90, y: 200, color: '#38bdf8' },
        { id: 'eq-cmp', label: 'CMP 화학기계적 연마기', cat: 'EQ', icon: '⚙️', desc: '슬러리와 폴리우레탄 패드를 이용해 웨이퍼 표면을 나노 단위로 평탄화하는 연마 설비', x: 90, y: 330, color: '#38bdf8' },
        { id: 'eq-sputter', label: '스퍼터(Sputter) 금속 증착기', cat: 'EQ', icon: '🔬', desc: 'Ar 이온 타격으로 타깃 금속 원자를 튕겨내어 배선 박막을 형성하는 고진공 물리 증착기', x: 90, y: 460, color: '#38bdf8' },

        // 2. 센서/지표 (SEN)
        { id: 'sen-press', label: '챔버 진공 압력 센서', cat: 'SEN', icon: '📡', desc: '정밀 커패시턴스 마노미터 및 피라니 게이지 (정격: 1.2×10⁻³ Torr, 오차 ±0.05)', x: 285, y: 70, color: '#00e5ff' },
        { id: 'sen-rf', label: 'RF 반사파 전력 센서', cat: 'SEN', icon: '📶', desc: '플라즈마 정합기 내 인라인 방향성 결합기 (반사파율 임계치: < 2.5%, 13.56MHz)', x: 285, y: 200, color: '#00e5ff' },
        { id: 'sen-he', label: '정전척 헬륨 냉각 압력계', cat: 'SEN', icon: '🌡️', desc: 'ESC 후면 헬륨 배압(Backside Helium Pressure) 모니터링 (공차: 8.0±0.4 Torr)', x: 285, y: 330, color: '#00e5ff' },
        { id: 'sen-slurry', label: 'CMP 슬러리 유량/마찰 센서', cat: 'SEN', icon: '📊', desc: '헤드 모터 구동 전류 및 슬러리 질량 유량계(MFC) (정격 유량: 250±5 ml/min)', x: 285, y: 460, color: '#00e5ff' },

        // 3. 결함 징후 (SYM)
        { id: 'sym-leak', label: '진공 챔버 미세 누설(Leak)', cat: 'SYM', icon: '⚠️', desc: '베이스 진공 도달 지연 (도달시간 정상 대비 +45% 초과), 압력 드리프트 발생', x: 480, y: 70, color: '#f59e0b' },
        { id: 'sym-arc', label: '플라즈마 아크 방전·불안정', cat: 'SYM', icon: '⚡', desc: '발광 스펙트럼(OES) 이상 피크 발생 및 RF 임피던스 미스매칭 위상각 진동', x: 480, y: 200, color: '#f59e0b' },
        { id: 'sym-temp', label: '웨이퍼 국소 온도 불균일', cat: 'SYM', icon: '🔥', desc: '정전척 외곽 에지(Edge) 온도 급상승 (정상 대비 +8.4°C), 에칭 깊이 편차 유발', x: 480, y: 330, color: '#f59e0b' },
        { id: 'sym-glaze', label: '연마 패드 표면 글레이징', cat: 'SYM', icon: '📉', desc: '패드 미세 기공 폐색 및 연마율(Removal Rate) 14.5% 급감, 웨이퍼 마찰 스크래치 위험', x: 480, y: 460, color: '#f59e0b' },

        // 4. 근본 원인 (RC)
        { id: 'rc-oring', label: '플랜지 O-링 고온 열화 경화', cat: 'RC', icon: '🔍', desc: '플라즈마 반응열 및 불소계 라디칼에 의한 불소탄성체 탄화 및 영구 압축 변형', x: 675, y: 70, color: '#ef4444' },
        { id: 'rc-cap', label: '정합기 진공 커패시터 편차', cat: 'RC', icon: '🔍', desc: 'RF 파워 매칭 박스 내 가변 진공 커패시터 기계적 축 마모로 인한 정전용량 이탈', x: 675, y: 200, color: '#ef4444' },
        { id: 'rc-seal', label: 'ESC 헬륨 실링 패킹 크랙', cat: 'RC', icon: '🔍', desc: '웨이퍼 척킹/디척킹 반복 열응력에 기인한 세라믹-엘라스토머 계면 미세 균열', x: 675, y: 330, color: '#ef4444' },
        { id: 'rc-disk', label: '컨디셔너 디스크 다이아 마모', cat: 'RC', icon: '🔍', desc: 'CMP 다이아몬드 컨디셔너 디스크 입자 탈락 및 평탄화로 패드 그루브 재생 불가', x: 675, y: 460, color: '#ef4444' },

        // 5. 조치 SOP (SOP)
        { id: 'sop-01', label: 'SOP-01: O-링 교체·He 리크 검사', cat: 'SOP', icon: '📘', desc: 'LOTO 차단 ➔ N₂ 퍼지 ➔ 챔버 개방 ➔ FFKM O-링 교체 (15N·m 체결) ➔ He 리크 테스트 (< 1.0×10⁻⁹ Torr·L/s)', x: 870, y: 70, color: '#f97316' },
        { id: 'sop-02', label: 'SOP-02: RF 매처 위상각 영점 교정', cat: 'SOP', icon: '📘', desc: 'LOTO 차단 ➔ 더미 로드(50Ω) 체결 ➔ 스트로크 모터 원점 캘리브레이션 ➔ 반사파율 < 0.5% 복구', x: 870, y: 200, color: '#f97316' },
        { id: 'sop-03', label: 'SOP-03: ESC 헬륨 실링 재체결', cat: 'SOP', icon: '📘', desc: 'ESC 하부 모듈 탈거 ➔ 세라믹 표면 에탄올 세정 ➔ 고내열 실링 패킹 교체 ➔ 차압 유지력 3회 시험', x: 870, y: 330, color: '#f97316' },
        { id: 'sop-04', label: 'SOP-04: 연마 패드 교체·노즐 세정', cat: 'SOP', icon: '📘', desc: '플래튼 세정 ➔ IC1000 패드 균일 압착 부착 (2.5 bar) ➔ 컨디셔너 교체 ➔ 30분 브레이크인 시운전', x: 870, y: 460, color: '#f97316' },

        // 6. 소요 부품/공구 (PART/TOOL)
        { id: 'part-oring', label: 'FFKM 내열 O-링 세트', cat: 'PART', icon: '🔩', desc: '규격: AS568-342 (내열 320°C, 반도체 플라즈마 공정 인증 정품 부품)', x: 1070, y: 45, color: '#10b981' },
        { id: 'tool-torque', label: '15 N·m 디지털 토크 렌치', cat: 'TOOL', icon: '🔧', desc: '오차 ±0.5% 이내 공인 교정 완료, 무선 체결 토크 데이터 자동 로깅 지원', x: 1070, y: 175, color: '#10b981' },
        { id: 'tool-leak', label: '헬륨 질량분석 리크 검출기', cat: 'TOOL', icon: '🔬', desc: '초고감도 진공 리크 디텍터 (감도 1.0×10⁻¹¹ Torr·L/s, 정밀 스프레이 프로브)', x: 1070, y: 305, color: '#10b981' },
        { id: 'part-pad', label: '30인치 IC1000 그루브 패드', cat: 'PART', icon: '📦', desc: '미세 다공성 폴리우레탄 연마 패드 (제조사 바코드 인증 정품)', x: 1070, y: 435, color: '#10b981' },

        // 7. 담당자 (PER)
        { id: 'per-vac', label: '김정비 책임 (진공 특화)', cat: 'PER', icon: '👤', desc: '진공 챔버 및 배관 계통 12년 경력 전문 기술자, LOTO 작업자 1차 승인자', x: 1070, y: 105, color: '#a855f7' },
        { id: 'per-rf', label: '박고주파 수석 (RF 전력)', cat: 'PER', icon: '👤', desc: '13.56MHz 고주파 발진기 및 매칭 네트워크 임피던스 제어 전문 수석 연구원', x: 1070, y: 235, color: '#a855f7' },
        { id: 'per-cmp', label: '이연마 선임 (CMP 평탄화)', cat: 'PER', icon: '👤', desc: '웨이퍼 평탄화 공정 및 슬러리 공급계통 전문 정비 기술원', x: 1070, y: 365, color: '#a855f7' },
        { id: 'per-safety', label: '최안전 관리자 (환경안전)', cat: 'PER', icon: '🛡️', desc: '공장 환경안전 총괄 관리자, LOTO 차단 확인 및 PTW 전자 서명 승인권자', x: 1070, y: 495, color: '#a855f7' }
    ];

    // 지식그래프 28개 인과 관계 엣지 정의
    const kgEdges = [
        // 설비 ➔ 센서 (계측)
        { source: 'eq-pecvd', target: 'sen-press', rel: '진공 계측' },
        { source: 'eq-pecvd', target: 'sen-rf', rel: 'RF 전력 계측' },
        { source: 'eq-icp', target: 'sen-rf', rel: '플라즈마 계측' },
        { source: 'eq-icp', target: 'sen-he', rel: '헬륨 압력 계측' },
        { source: 'eq-cmp', target: 'sen-slurry', rel: '슬러리/마찰 계측' },
        { source: 'eq-sputter', target: 'sen-press', rel: '고진공 계측' },

        // 센서 ➔ 결함 징후 (감지)
        { source: 'sen-press', target: 'sym-leak', rel: '진공 지연 감지' },
        { source: 'sen-rf', target: 'sym-arc', rel: '반사파 급증 감지' },
        { source: 'sen-he', target: 'sym-temp', rel: '온도 불균일 감지' },
        { source: 'sen-slurry', target: 'sym-glaze', rel: '패드 마모 감지' },

        // 결함 징후 ➔ 근본 원인 (인과)
        { source: 'sym-leak', target: 'rc-oring', rel: 'O-링 열화 귀속' },
        { source: 'sym-arc', target: 'rc-cap', rel: '커패시터 편차 귀속' },
        { source: 'sym-temp', target: 'rc-seal', rel: '실링 크랙 귀속' },
        { source: 'sym-glaze', target: 'rc-disk', rel: '디스크 마모 귀속' },

        // 근본 원인 ➔ 조치 SOP (처방)
        { source: 'rc-oring', target: 'sop-01', rel: '표준 조치 적용' },
        { source: 'rc-cap', target: 'sop-02', rel: '영점 교정 적용' },
        { source: 'rc-seal', target: 'sop-03', rel: '실링 재체결 적용' },
        { source: 'rc-disk', target: 'sop-04', rel: '패드 교체 적용' },

        // 조치 SOP ➔ 부품/공구 (소요)
        { source: 'sop-01', target: 'part-oring', rel: '정품 O-링 투입' },
        { source: 'sop-01', target: 'tool-torque', rel: '15N·m 토크 체결' },
        { source: 'sop-01', target: 'tool-leak', rel: '리크 검출기 사용' },
        { source: 'sop-02', target: 'tool-torque', rel: '규격 토크 조임' },
        { source: 'sop-03', target: 'tool-torque', rel: '토크 렌치 체결' },
        { source: 'sop-03', target: 'tool-leak', rel: '차압 리크 검사' },
        { source: 'sop-04', target: 'part-pad', rel: 'IC1000 신품 교체' },

        // 조치 SOP ➔ 담당자 (배정 및 승인)
        { source: 'sop-01', target: 'per-vac', rel: '정비 작업 배정' },
        { source: 'sop-01', target: 'per-safety', rel: 'PTW 승인' },
        { source: 'sop-02', target: 'per-rf', rel: 'RF 기술원 배정' },
        { source: 'sop-03', target: 'per-vac', rel: '진공 기술원 배정' },
        { source: 'sop-04', target: 'per-cmp', rel: 'CMP 정비원 배정' },
        { source: 'sop-04', target: 'per-safety', rel: '안전 확인 배정' }
    ];

    // 표준행동절차(SOP) 5단계 라이프사이클 정의
    const sopLifecycleSteps = [
        {
            step: 1,
            name: '1단계. 이상 감지 및 원인 귀속',
            summary: '텔레메트리 파라미터 3시그마 이탈 감지 및 지식그래프 원인 자동 추론',
            dept: '공정 제어실 (생산기술팀)',
            safetyRating: '관제 레벨 (온라인 진단)',
            spec: '경보 발생 5분 이내 심각도 분류 (P0 긴급 ~ P2 계획)',
            checklist: [
                '센서 텔레메트리 관리 한계선(UCL/LCL) 이탈 여부 크로스 체크',
                '지식그래프 기반 근본 원인 후보 자동 매핑 및 신뢰도 점검',
                '현장 운영 엔지니어 1차 통보 및 위험 설비 가동 일시 보류'
            ]
        },
        {
            step: 2,
            name: '2단계. 작업허가(PTW) 및 LOTO 격리',
            summary: '3자 전자 서명 안전작업허가 발급, 전원/공압 3중 패드락 차단, 유독가스 퍼지',
            dept: '환경안전팀 & 설비 보전팀',
            safetyRating: 'LOTO 1등급 절대 물리 차단',
            spec: '잔류 가스 N₂ 퍼지 5회 / 산소 농도 21%±1% / 유독가스 0.00 ppm',
            checklist: [
                '공정 엔지니어, 설비 책임자, 환경안전관리자 3자 전자인증(Digital Tri-Sign)',
                '주 전원 회로 차단기(MCCB) 개방 및 전용 패드락(Padlock) 시건 체결',
                '공압 공급 밸브 벤트 배기 및 유독가스 라인 이중 블록 밸브 차단'
            ]
        },
        {
            step: 3,
            name: '3단계. 표준 정비 및 규격 체결',
            summary: '인증 정품 부품 투입, 디지털 토크 렌치 15 N·m 정밀 체결, 챔버 드라이 세정',
            dept: '전문 정비 보전팀',
            safetyRating: '클린룸 방진복 & 내화학 보호구',
            spec: '체결 토크 15.0 N·m (허용 오차 ±0.5 N·m) / 십자 대각 조임',
            checklist: [
                '제조사 바코드 인증 정품 부품(FFKM/IC1000 패드 등) 일치 확인',
                '디지털 토크 렌치 블루투스 연동 및 십자 대각 체결 이력 자동 로깅',
                '챔버 실링 플랜지 무수에탄올 정밀 세정 및 잔류 파티클 제로화'
            ]
        },
        {
            step: 4,
            name: '4단계. 시편 시험 및 Cpk 검증',
            summary: '테스트 웨이퍼/패널 3회 연속 시험가동, 두께 균일도 및 Cpk ≥ 1.67 정합성 확인',
            dept: '공정 품질 분석실 (QA/QC)',
            safetyRating: '시험 생산 검증 레벨',
            spec: '3회 연속 샘플 Cpk 1.67 이상 / 박막 두께 균일도 99.8% 달성',
            checklist: [
                '테스트 웨이퍼 3매 연속 생산 투입 및 텔레메트리 실시간 안정화 확인',
                '분광 엘립소미터 박막 두께 및 굴절률(RI) 허용 공차 정합성 계측',
                '품질 보증 엔지니어 공정능력지수(Cpk) 최종 합격 서명 완료'
            ]
        },
        {
            step: 5,
            name: '5단계. 양산 복구 및 지식화 피드백',
            summary: '설비 인터록 정상 해제, 양산 투입 재개, 정비 이력 및 해결 노하우 지식그래프 영구 등재',
            dept: '라인 총괄 운영실',
            safetyRating: '정상 가동 복구 완료',
            spec: 'AI 인과그래프 자동 업데이트 / 평균 수리시간(MTTR) 집계',
            checklist: [
                'LOTO 물리 패드락 해제 및 비상 안전 인터록 정상 감지 시운전',
                'MES/ERP 생산 계획 연동을 통한 양산 랏(Lot) 투입 즉시 재개',
                '작업 소요시간, 교체 부품 시리얼, 원인 분석 지식베이스 영구 피드백'
            ]
        }
    ];

    // SOP 5단계 라이프사이클 렌더링
    function renderSopLifecycle() {
        const trackEl = document.getElementById('sopStepsTrack');
        const detailEl = document.getElementById('sopDetailPanel');
        if (!trackEl || !detailEl) return;

        trackEl.innerHTML = sopLifecycleSteps.map(s => `
            <div class="sop-step-tile ${state.selectedSopStep === s.step ? 'active' : ''}" onclick="window.selectSopLifecycleStep(${s.step})">
                <div class="sop-step-tile-top">
                    <span class="sop-step-number">STEP 0${s.step}</span>
                    <span style="font-size:12px; color:var(--text-muted);">${state.selectedSopStep === s.step ? '●' : '○'}</span>
                </div>
                <div class="sop-step-name">${s.name.replace(/^\d단계\.\s*/, '')}</div>
                <div class="sop-step-brief">${s.summary}</div>
            </div>
        `).join('');

        const cur = sopLifecycleSteps.find(s => s.step === state.selectedSopStep) || sopLifecycleSteps[0];
        detailEl.innerHTML = `
            <div class="sop-detail-header">
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="code-badge" style="background:rgba(249,115,22,0.18); color:var(--bus-sop); font-weight:700;">${cur.name}</span>
                        <span style="font-size:14px; font-weight:700; color:var(--text-primary);">${cur.summary}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                        주관 부서: <strong style="color:var(--text-accent);">${cur.dept}</strong> · 안전 관리 등급: <strong style="color:var(--color-alert);">${cur.safetyRating}</strong>
                    </div>
                </div>
                <div class="principle-spec-pill" style="font-size:11px;">
                    🎯 표준 규격 기준: ${cur.spec}
                </div>
            </div>
            <div class="sop-detail-check-grid">
                ${cur.checklist.map((item, i) => `
                    <div class="sop-check-item">
                        <span style="color:var(--color-normal); font-size:14px; font-weight:800;">✓</span>
                        <span>[확인 ${i + 1}] ${item}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    window.selectSopLifecycleStep = function (stepNum) {
        state.selectedSopStep = stepNum;
        renderSopLifecycle();
    };

    // 지식그래프 SVG 렌더링
    function renderKnowledgeGraph() {
        const svgEl = document.getElementById('kgSvgCanvas');
        const statusTag = document.getElementById('kgActiveStatusTag');
        if (!svgEl) return;

        const selectedId = state.selectedKgNode;
        const filterType = state.kgFilter;
        const query = state.kgSearchQuery;

        // 필터링 적용 노드 결정
        let visibleNodeIds = new Set(kgNodes.map(n => n.id));
        if (filterType === 'EQ_SEN') {
            visibleNodeIds = new Set(kgNodes.filter(n => n.cat === 'EQ' || n.cat === 'SEN').map(n => n.id));
        } else if (filterType === 'SYM_RC') {
            visibleNodeIds = new Set(kgNodes.filter(n => n.cat === 'SYM' || n.cat === 'RC').map(n => n.id));
        } else if (filterType === 'SOP_PART') {
            visibleNodeIds = new Set(kgNodes.filter(n => n.cat === 'SOP' || n.cat === 'PART' || n.cat === 'TOOL' || n.cat === 'PER').map(n => n.id));
        }

        if (query) {
            const matched = kgNodes.filter(n => n.label.toLowerCase().includes(query) || n.desc.toLowerCase().includes(query) || n.cat.toLowerCase().includes(query));
            visibleNodeIds = new Set(matched.map(n => n.id));
        }

        // 선택 노드 기반 연관 노드 및 엣지 세트 계산
        const connectedNodeIds = new Set();
        const activeEdgeIndices = new Set();

        if (selectedId) {
            connectedNodeIds.add(selectedId);
            // 1차 연결 (인접 노드)
            kgEdges.forEach((e, idx) => {
                if (e.source === selectedId) {
                    connectedNodeIds.add(e.target);
                    activeEdgeIndices.add(idx);
                } else if (e.target === selectedId) {
                    connectedNodeIds.add(e.source);
                    activeEdgeIndices.add(idx);
                }
            });
            // 2차 연결 (인과 경로 확장)
            kgEdges.forEach((e, idx) => {
                if (connectedNodeIds.has(e.source) && !connectedNodeIds.has(e.target)) {
                    connectedNodeIds.add(e.target);
                    activeEdgeIndices.add(idx);
                } else if (connectedNodeIds.has(e.target) && !connectedNodeIds.has(e.source)) {
                    connectedNodeIds.add(e.source);
                    activeEdgeIndices.add(idx);
                }
            });
        }

        if (statusTag) {
            if (selectedId) {
                const selNode = kgNodes.find(n => n.id === selectedId);
                statusTag.innerText = `선택: [${selNode ? selNode.label : selectedId}] · 연관 인과 노드 ${connectedNodeIds.size}개 및 엣지 ${activeEdgeIndices.size}개 활성`;
                statusTag.style.background = 'rgba(249,115,22,0.2)';
                statusTag.style.color = 'var(--bus-sop)';
            } else {
                statusTag.innerText = '노드를 클릭하여 연관 인과망 탐색';
                statusTag.style.background = 'rgba(0,229,255,0.15)';
                statusTag.style.color = 'var(--bus-sensor)';
            }
        }

        // 엣지 SVG 패스 생성
        const edgesHtml = kgEdges.map((e, idx) => {
            const s = kgNodes.find(n => n.id === e.source);
            const t = kgNodes.find(n => n.id === e.target);
            if (!s || !t) return '';

            const sWidth = (s.cat === 'PART' || s.cat === 'TOOL' || s.cat === 'PER') ? 140 : 160;
            const tWidth = (t.cat === 'PART' || t.cat === 'TOOL' || t.cat === 'PER') ? 140 : 160;

            const sx = s.x + sWidth / 2;
            const sy = s.y;
            const tx = t.x - tWidth / 2;
            const ty = t.y;
            const dx = Math.max(30, (tx - sx) * 0.45);

            const pathD = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
            const isActive = activeEdgeIndices.has(idx);
            const isDimmed = selectedId && !isActive;

            return `
                <path d="${pathD}" 
                      class="kg-edge ${isActive ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}" 
                      marker-end="${isActive ? 'url(#kgArrowActive)' : 'url(#kgArrow)'}" />
            `;
        }).join('');

        // 노드 SVG 카드 생성
        const nodesHtml = kgNodes.map(n => {
            const isVisible = visibleNodeIds.has(n.id);
            const isSelected = selectedId === n.id;
            const isConnected = selectedId && connectedNodeIds.has(n.id) && !isSelected;
            const isDimmed = !isVisible || (selectedId && !isSelected && !isConnected);

            const width = (n.cat === 'PART' || n.cat === 'TOOL' || n.cat === 'PER') ? 140 : 160;
            const height = 40;
            const rx = 6;
            const ry = 6;
            const x = n.x - width / 2;
            const y = n.y - height / 2;

            return `
                <g class="kg-node-g ${isSelected ? 'active' : ''} ${isConnected ? 'connected' : ''} ${isDimmed ? 'dimmed' : ''}" 
                   onclick="window.selectKgNode('${n.id}')"
                   transform="translate(0, 0)">
                    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${ry}" 
                          fill="#14202c" stroke="${n.color}" stroke-width="${isSelected ? '2.5' : (isConnected ? '2' : '1.2')}" />
                    <text x="${x + 12}" y="${y + 25}" font-size="15">${n.icon}</text>
                    <text x="${x + 34}" y="${y + 24}" fill="#e6edf3" font-size="11" font-weight="600">${n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}</text>
                    <text x="${x + width - 8}" y="${y + 14}" fill="${n.color}" font-size="8.5" text-anchor="end" font-weight="700">${n.cat}</text>
                </g>
            `;
        }).join('');

        svgEl.innerHTML = `
            <defs>
                <marker id="kgArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334d66" />
                </marker>
                <marker id="kgArrowActive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#f97316" />
                </marker>
            </defs>
            <g class="kg-edges-layer">${edgesHtml}</g>
            <g class="kg-nodes-layer">${nodesHtml}</g>
        `;
    }

    // 지식 인스펙터 패널 렌더링
    function renderKnowledgeInspector() {
        const cardEl = document.getElementById('kgInspectorCard');
        if (!cardEl) return;

        const selectedId = state.selectedKgNode;
        if (!selectedId) {
            cardEl.innerHTML = `
                <div class="kg-inspector-empty">
                    <span style="font-size:36px; opacity:0.4;">🧠</span>
                    <strong style="color:var(--text-primary); font-size:14px;">선택된 지식 노드가 없습니다</strong>
                    <span style="font-size:12px;">좌측 지식그래프에서 노드를 클릭하면 인과 관계망과 권장 표준 조치(SOP), 부품/공구 및 담당자를 확인할 수 있습니다.</span>
                </div>
            `;
            return;
        }

        const node = kgNodes.find(n => n.id === selectedId);
        if (!node) return;

        // 선행 연결 노드 (나에게로 들어오는 엣지)
        const inNodes = kgEdges.filter(e => e.target === selectedId).map(e => ({
            edge: e,
            node: kgNodes.find(n => n.id === e.source)
        })).filter(x => x.node);

        // 후행 연결 노드 (나로부터 나가는 엣지)
        const outNodes = kgEdges.filter(e => e.source === selectedId).map(e => ({
            edge: e,
            node: kgNodes.find(n => n.id === e.target)
        })).filter(x => x.node);

        // 도메인 지침 매핑
        let principleText = "정비 작업 시 전기·공압 LOTO 물리 차단 및 작업허가(PTW) 교차 승인을 확인하십시오.";
        if (node.cat === 'EQ') principleText = "실시간 금속 표면파 센서 텔레메트리 연동 설비 · 비계획 다운타임 방지 집중 감시 중";
        else if (node.cat === 'SEN') principleText = "정격 공차 한계선(UCL/LCL) 3시그마 관리 및 금속 표면파 실시간 고속 전송 중";
        else if (node.cat === 'SYM') principleText = "AI 이상 징후 자동 탐지 · 심각도 P0~P2 신속 분류 및 인터록 연동 상태";
        else if (node.cat === 'RC') principleText = "AI 인과 추론 신뢰도 99.2% 귀속 · 동일 원인 재발 방지 피드백 루프 적용";
        else if (node.cat === 'SOP') principleText = "LOTO 절대 물리 격리 원칙 & 규격 디지털 토크 렌치 15.0 N·m 준수 필수";
        else if (node.cat === 'PART' || node.cat === 'TOOL') principleText = "반도체 플라즈마 공인 인증 정품 자재 및 연례 교정 필증 공구 사용 의무";
        else if (node.cat === 'PER') principleText = "EHS 환경안전 인증 기술 자격 보유자 · 작업허가서 전자 서명 필수";

        cardEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="code-badge" style="background:${node.color}22; color:${node.color}; font-weight:700;">${node.cat}</span>
                        <span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${node.id}</span>
                    </div>
                    <div style="font-size:16px; font-weight:800; color:var(--text-primary); margin-top:4px; display:flex; align-items:center; gap:6px;">
                        <span>${node.icon}</span>
                        <span>${node.label}</span>
                    </div>
                </div>
                <button class="tool-btn" onclick="window.resetKgSelection()" style="padding:3px 8px; font-size:11px;">닫기</button>
            </div>

            <!-- 핵심 설명 -->
            <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; background:var(--bg-surface-elevated); padding:10px 12px; border-radius:6px; border:1px solid var(--border-color);">
                ${node.desc}
            </div>

            <!-- 선행 인과 관계 -->
            <div class="kg-rel-box">
                <span class="kg-rel-label">선행 연결 (원인 / 계측 센서 / 대상 설비)</span>
                ${inNodes.length > 0 ? `
                    <div class="kg-rel-pill-list">
                        ${inNodes.map(x => `
                            <div class="kg-rel-pill" onclick="window.selectKgNode('${x.node.id}')" title="${x.edge.rel}">
                                <span>${x.node.icon}</span>
                                <strong>${x.node.label}</strong>
                                <span style="font-size:9px; color:var(--text-muted);">(${x.edge.rel})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <span style="font-size:11px; color:var(--text-muted);">최상위 원천 노드 (선행 연결 없음)</span>
                `}
            </div>

            <!-- 후행 인과 관계 -->
            <div class="kg-rel-box">
                <span class="kg-rel-label">후행 연결 (조치 SOP / 소요 부품 / 담당자)</span>
                ${outNodes.length > 0 ? `
                    <div class="kg-rel-pill-list">
                        ${outNodes.map(x => `
                            <div class="kg-rel-pill" onclick="window.selectKgNode('${x.node.id}')" title="${x.edge.rel}">
                                <span>${x.node.icon}</span>
                                <strong>${x.node.label}</strong>
                                <span style="font-size:9px; color:var(--text-muted);">(${x.edge.rel})</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <span style="font-size:11px; color:var(--text-muted);">최하위 실행 노드 (후행 연결 없음)</span>
                `}
            </div>

            <!-- 안전 및 표준 준수 지침 -->
            <div style="background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.25); border-radius:6px; padding:10px 12px;">
                <div style="font-size:11px; font-weight:700; color:var(--bus-sop); margin-bottom:4px;">🛡️ 안전 및 표준운영원칙 준수 기준</div>
                <div style="font-size:11.5px; color:var(--text-primary); line-height:1.4;">${principleText}</div>
            </div>

            <!-- 작업 발행 버튼 -->
            <button class="tool-btn" style="background:var(--bus-sop); color:#fff; border:none; padding:10px 14px; font-weight:700; font-size:12.5px; border-radius:6px; width:100%; cursor:pointer;" onclick="window.createTaskFromKnowledge('${node.id}')">
                ⚡ 이 지식으로 현장 정비 작업 즉시 발행
            </button>
        `;
    }

    // 작업 원장 테이블 렌더링
    function renderTaskLedger() {
        const tbody = document.getElementById('taskListTableBody');
        const badge = document.getElementById('taskCountBadge');
        if (!tbody) return;

        if (badge) {
            badge.innerText = `${state.tasks.length}건 등록`;
        }

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

    // 종합 뷰 렌더링
    function renderTaskView() {
        renderSopLifecycle();
        renderKnowledgeGraph();
        renderKnowledgeInspector();
        renderTaskLedger();
    }

    // 인터랙션 헬퍼
    window.selectKgNode = function (nodeId) {
        if (state.selectedKgNode === nodeId) {
            state.selectedKgNode = null;
        } else {
            state.selectedKgNode = nodeId;
        }
        renderKnowledgeGraph();
        renderKnowledgeInspector();
    };

    window.filterKg = function (filterType) {
        state.kgFilter = filterType;
        document.querySelectorAll('#kgFilterGroup .kg-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filterType);
        });
        renderKnowledgeGraph();
    };

    window.searchKg = function (query) {
        state.kgSearchQuery = (query || '').trim().toLowerCase();
        renderKnowledgeGraph();
    };

    window.resetKgSelection = function () {
        state.selectedKgNode = null;
        state.kgFilter = 'ALL';
        state.kgSearchQuery = '';
        const searchInput = document.getElementById('kgSearchInput');
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('#kgFilterGroup .kg-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'ALL');
        });
        renderKnowledgeGraph();
        renderKnowledgeInspector();
    };

    window.createTaskFromKnowledge = function (nodeId) {
        const node = kgNodes.find(n => n.id === nodeId);
        if (!node) return;

        // 관련 SOP, 설비, 담당자 추론
        let targetSop = node;
        let targetEq = '반도체 대표 설비';
        let targetAssignee = '김정비 책임';

        if (node.cat === 'SOP') {
            targetSop = node;
        } else {
            // 연결된 SOP 찾기
            const outSop = kgEdges.find(e => e.source === nodeId && e.target.startsWith('sop-'));
            const inSop = kgEdges.find(e => e.target === nodeId && e.source.startsWith('sop-'));
            const matchedSopId = (outSop ? outSop.target : (inSop ? inSop.source : 'sop-01'));
            targetSop = kgNodes.find(n => n.id === matchedSopId) || node;
        }

        if (node.id === 'eq-pecvd' || node.id === 'sen-rf' || node.id === 'rc-cap' || node.id === 'sop-02') {
            targetEq = 'PECVD 플라즈마 증착기';
            targetAssignee = '박고주파 수석';
        } else if (node.id === 'eq-icp' || node.id === 'sen-he' || node.id === 'rc-seal' || node.id === 'sop-03') {
            targetEq = 'ICP 고밀도 플라즈마 식각기';
            targetAssignee = '이수석 기술원';
        } else if (node.id === 'eq-cmp' || node.id === 'sen-slurry' || node.id === 'rc-disk' || node.id === 'sop-04') {
            targetEq = '화학기계적 연마기(CMP)';
            targetAssignee = '이연마 선임';
        } else {
            targetEq = '플라즈마 화학 증착기';
            targetAssignee = '김정비 책임';
        }

        const newId = `작업-2027-${String(state.tasks.length + 101).padStart(4, '0')}`;
        const newTask = {
            id: newId,
            eqId: 'EQ_SEMI_03',
            eqName: targetEq,
            priority: 'P0 긴급',
            title: `[지식연계] ${targetSop.label} (근거: ${node.label})`,
            assignee: targetAssignee,
            status: 'PENDING_APPROVAL',
            date: state.simDate.toISOString().slice(0, 10)
        };

        state.tasks.unshift(newTask);
        renderTaskLedger();

        // 사용자 피드백 알림 및 원장 영역 스크롤
        alert(`[정비 지식그래프 연계 작업지시 발행 완료]\n\n• 작업번호: ${newTask.id}\n• 대상설비: ${newTask.eqName}\n• 작업명: ${newTask.title}\n• 배정자: ${newTask.assignee}\n\n작업허가(PTW) 교차 승인 후 LOTO 물리 격리 상태에서 정비를 진행하십시오.`);
        const ledgerEl = document.getElementById('taskLedgerCard');
        if (ledgerEl) {
            ledgerEl.scrollIntoView({ behavior: 'smooth' });
        }
    };

    window.advanceTaskStatus = function (taskId) {
        const t = state.tasks.find(x => x.id === taskId);
        if (!t) return;
        if (t.status === 'PENDING_APPROVAL') {
            t.status = 'IN_PROGRESS';
            t.assignee = `${t.assignee.replace(' (승인완료)', '')} (승인완료)`;
        } else if (t.status === 'IN_PROGRESS') {
            t.status = 'COMPLETED';
        }
        renderTaskLedger();
    };

    function openNewTaskModal() {
        const title = prompt("새로운 현장 점검 및 정비 작업의 명칭을 입력하십시오:", "진공 챔버 게이지 교정 및 배관 리크 점검");
        if (!title) return;
        state.tasks.unshift({
            id: `작업-2027-${String(state.tasks.length + 101).padStart(4, '0')}`,
            eqId: 'EQ_SEMI_01',
            eqName: '반도체 대표 설비',
            priority: 'P1 점검',
            title: title,
            assignee: '운영 담당자',
            status: 'PENDING_APPROVAL',
            date: state.simDate.toISOString().slice(0, 10)
        });
        renderTaskLedger();
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
