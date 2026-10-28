/**
 * AURORA Industrial Intelligence - 2D Equipment SVG Vectors
 * PRD v1.0 7.2절 및 8.1절 준수:
 * - 반도체 10공정 및 OLED 10공정 설비 정밀 2D 벡터 일러스트레이션
 * - 세정조, 열처리로, 진공 증착챔버, 노광기, 식각기, 이온주입기, CMP 연마기, 레이저 절단기, 본더, 검사기
 * - 설비 상태별(정상/주의/경보/통신지연) 동적 스타일링 지원
 */

const EquipmentSVGs = {
    // 1. 세정조 (Cleaning Bath / Spray)
    cleaner: (status = 'normal', label = '세정설비') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <defs>
                <linearGradient id="tankGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#2a3b4c"/>
                    <stop offset="100%" stop-color="#141f2d"/>
                </linearGradient>
                <linearGradient id="fluidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.8"/>
                    <stop offset="100%" stop-color="#0077b6" stop-opacity="0.9"/>
                </linearGradient>
            </defs>
            <!-- 프레임 -->
            <rect x="15" y="20" width="130" height="100" rx="6" fill="url(#tankGrad)" stroke="#4a6572" stroke-width="2"/>
            <rect x="25" y="35" width="110" height="70" rx="4" fill="#0b131e" stroke="#1f2d3d" stroke-width="1.5"/>
            <!-- 세정액 수조 -->
            <rect x="28" y="55" width="104" height="48" rx="2" fill="url(#fluidGrad)" opacity="0.85"/>
            <!-- 초음파/스프레이 노즐 -->
            <line x1="35" y1="42" x2="125" y2="42" stroke="#90a4ae" stroke-width="3"/>
            <circle cx="50" cy="48" r="3" fill="#00e5ff"/>
            <circle cx="80" cy="48" r="3" fill="#00e5ff"/>
            <circle cx="110" cy="48" r="3" fill="#00e5ff"/>
            <!-- 거품/초음파 파동 -->
            <circle cx="55" cy="70" r="4" fill="#fff" opacity="0.6"/>
            <circle cx="85" cy="65" r="5" fill="#fff" opacity="0.7"/>
            <circle cx="105" cy="75" r="3" fill="#fff" opacity="0.5"/>
            <!-- 상태 LED -->
            <circle cx="130" cy="28" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 2. 급속 열처리로 (Furnace / RTP)
    furnace: (status = 'normal', label = '열처리로') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <defs>
                <linearGradient id="furnaceGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#ff7043"/>
                    <stop offset="50%" stop-color="#f4511e"/>
                    <stop offset="100%" stop-color="#bf360c"/>
                </linearGradient>
            </defs>
            <!-- 외부 차폐 바디 -->
            <rect x="25" y="15" width="110" height="105" rx="8" fill="#1c2530" stroke="#ff7043" stroke-width="1.5"/>
            <!-- 히터 석영관 튜브 -->
            <rect x="45" y="25" width="70" height="85" rx="6" fill="#101720" stroke="#37474f"/>
            <rect x="52" y="32" width="56" height="70" rx="4" fill="url(#furnaceGlow)" opacity="0.85"/>
            <!-- 발열 코일 라인 -->
            <line x1="56" y1="42" x2="104" y2="42" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
            <line x1="56" y1="54" x2="104" y2="54" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
            <line x1="56" y1="66" x2="104" y2="66" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
            <line x1="56" y1="78" x2="104" y2="78" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
            <line x1="56" y1="90" x2="104" y2="90" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
            <!-- 하부 보트 엘리베이터 -->
            <rect x="65" y="105" width="30" height="8" fill="#78909c"/>
            <!-- 상태 LED -->
            <circle cx="125" cy="25" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 3. 진공 증착기 (CVD / Sputter / Evaporator)
    evaporator: (status = 'normal', label = '증착챔버') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <defs>
                <radialGradient id="plasmaGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#b388ff" stop-opacity="0.9"/>
                    <stop offset="60%" stop-color="#7c4dff" stop-opacity="0.5"/>
                    <stop offset="100%" stop-color="#12005e" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <!-- 원형 진공 챔버 돔 -->
            <rect x="20" y="30" width="120" height="85" rx="10" fill="#1b2631" stroke="#5d6d7e" stroke-width="2"/>
            <path d="M 40 30 Q 80 5 120 30" fill="none" stroke="#5d6d7e" stroke-width="3"/>
            <!-- 뷰포트 창 -->
            <circle cx="80" cy="72" r="32" fill="#0b1016" stroke="#00e5ff" stroke-width="2"/>
            <circle cx="80" cy="72" r="28" fill="url(#plasmaGlow)"/>
            <!-- 상부 타겟 소스 및 기판 -->
            <rect x="60" y="48" width="40" height="6" fill="#cfd8dc"/>
            <rect x="65" y="90" width="30" height="4" fill="#ffd54f"/>
            <!-- 진공 게이지 배관 -->
            <path d="M 135 60 L 148 60 L 148 85 L 135 85" fill="none" stroke="#78909c" stroke-width="2"/>
            <!-- 상태 LED -->
            <circle cx="130" cy="22" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 4. 노광기 (Photolithography Scanner / Stepper)
    photolithography: (status = 'normal', label = '노광기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <!-- 정밀 방진 캐비닛 바디 -->
            <rect x="18" y="15" width="124" height="105" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
            <!-- 렌즈 컬럼 광학 타워 -->
            <polygon points="60,25 100,25 90,65 70,65" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
            <circle cx="80" cy="35" r="6" fill="#38bdf8" opacity="0.8"/>
            <!-- 레이저 빔 광선 (EUV/DUV) -->
            <polygon points="75,65 85,65 95,95 65,95" fill="#38bdf8" opacity="0.35"/>
            <line x1="80" y1="65" x2="80" y2="95" stroke="#fff" stroke-width="2" stroke-dasharray="3,2"/>
            <!-- 레티클 마스크 & 웨이퍼 스테이지 -->
            <rect x="68" y="62" width="24" height="4" fill="#facc15"/>
            <rect x="50" y="96" width="60" height="8" rx="2" fill="#475569"/>
            <circle cx="80" cy="98" r="14" fill="#94a3b8"/>
            <!-- 상태 LED -->
            <circle cx="130" cy="25" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 5. 식각기 (Plasma Dry Etcher)
    etcher: (status = 'normal', label = '플라즈마 식각기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <defs>
                <linearGradient id="etchGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#00e676" stop-opacity="0.9"/>
                    <stop offset="100%" stop-color="#004d40" stop-opacity="0.3"/>
                </linearGradient>
            </defs>
            <!-- 하우징 -->
            <rect x="20" y="20" width="120" height="100" rx="8" fill="#1e242c" stroke="#00e676" stroke-width="1.8"/>
            <!-- 챔버 뷰포트 -->
            <rect x="36" y="35" width="88" height="65" rx="5" fill="#0f141a" stroke="#37474f"/>
            <!-- ICP 상부 RF 코일 전극 -->
            <ellipse cx="80" cy="45" rx="30" ry="6" fill="none" stroke="#81c784" stroke-width="2"/>
            <!-- 플라즈마 방전 -->
            <rect x="44" y="52" width="72" height="36" rx="4" fill="url(#etchGlow)"/>
            <!-- 반응성 이온 하향 화살표 패턴 -->
            <line x1="60" y1="56" x2="60" y2="76" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2"/>
            <line x1="80" y1="56" x2="80" y2="76" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2"/>
            <line x1="100" y1="56" x2="100" y2="76" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2"/>
            <!-- 하부 ESC 정전척 척킹 -->
            <rect x="52" y="88" width="56" height="6" fill="#546e7a"/>
            <!-- 상태 LED -->
            <circle cx="128" cy="30" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 6. 이온주입기 (Ion Implanter) - PRD 요구: 증착기와 뚜렷이 구별되는 빔라인 궤적 형상
    implanter: (status = 'normal', label = '이온주입기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <!-- 외곽 섀시 -->
            <rect x="15" y="18" width="130" height="102" rx="6" fill="#1a222d" stroke="#e040fb" stroke-width="1.8"/>
            <!-- 이온 소스 챔버 -->
            <rect x="25" y="32" width="28" height="35" rx="4" fill="#0d131a" stroke="#7b1fa2"/>
            <circle cx="39" cy="49" r="6" fill="#ea80fc"/>
            <!-- 질량 분석 전자석 (곡면 빔가이드 파이프) -->
            <path d="M 53 49 Q 80 49 85 75" fill="none" stroke="#ba68c8" stroke-width="7"/>
            <path d="M 53 49 Q 80 49 85 75" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/>
            <!-- 가속관 컬럼 -->
            <rect x="80" y="75" width="45" height="14" fill="#263238" stroke="#ce93d8"/>
            <!-- 타겟 웨이퍼 앤드 스테이션 -->
            <rect x="120" y="65" width="8" height="35" rx="2" fill="#ffd54f"/>
            <!-- 상태 LED -->
            <circle cx="132" cy="28" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 7. CMP 연마기 (Chemical Mechanical Planarization)
    cmp: (status = 'normal', label = 'CMP 연마기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <!-- 베이스 -->
            <rect x="20" y="25" width="120" height="95" rx="8" fill="#212b36" stroke="#00bcd4" stroke-width="1.8"/>
            <!-- 회전 연마 플래튼 패드 -->
            <ellipse cx="80" cy="85" rx="46" ry="16" fill="#37474f" stroke="#78909c" stroke-width="2"/>
            <ellipse cx="80" cy="85" rx="36" ry="11" fill="#455a64"/>
            <!-- 웨이퍼 캐리어 헤드 -->
            <rect x="45" y="42" width="30" height="18" rx="4" fill="#90a4ae"/>
            <line x1="60" y1="32" x2="60" y2="42" stroke="#b0bec5" stroke-width="4"/>
            <ellipse cx="60" cy="62" rx="14" ry="4" fill="#ffd54f"/>
            <!-- 슬러리 공급 암 (Slurry Arm) -->
            <path d="M 115 35 L 95 65 L 85 75" fill="none" stroke="#b0bec5" stroke-width="3"/>
            <circle cx="85" cy="75" r="3" fill="#00e5ff"/>
            <!-- 상태 LED -->
            <circle cx="128" cy="35" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 8. 레이저 절단기 / 다이싱기 (Laser Dicing / Scribe)
    dicer: (status = 'normal', label = '레이저 절단기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <!-- 프레임 -->
            <rect x="18" y="20" width="124" height="100" rx="6" fill="#1b232c" stroke="#ff5252" stroke-width="1.8"/>
            <!-- 커팅 갠트리 축 -->
            <rect x="30" y="35" width="100" height="10" rx="3" fill="#37474f"/>
            <!-- 레이저 헤드 블록 -->
            <rect x="68" y="38" width="24" height="22" rx="3" fill="#455a64" stroke="#ff5252"/>
            <!-- 절단 레이저 빔 -->
            <line x1="80" y1="60" x2="80" y2="92" stroke="#ff1744" stroke-width="2.5"/>
            <circle cx="80" cy="92" r="4" fill="#ffff00" opacity="0.9"/>
            <!-- 척 테이블 & 진공 흡착 플레이트 -->
            <rect x="35" y="94" width="90" height="12" rx="2" fill="#263238" stroke="#607d8b"/>
            <!-- 절단 격자 라인 -->
            <line x1="55" y1="94" x2="55" y2="106" stroke="#90a4ae" stroke-dasharray="2,2"/>
            <line x1="75" y1="94" x2="75" y2="106" stroke="#90a4ae" stroke-dasharray="2,2"/>
            <line x1="95" y1="94" x2="95" y2="106" stroke="#90a4ae" stroke-dasharray="2,2"/>
            <!-- 상태 LED -->
            <circle cx="130" cy="28" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 9. 패키징 / 본더 (Packaging / Flip-Chip / Wire Bonder)
    bonder: (status = 'normal', label = '본딩·패키징기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <!-- 설비 본체 -->
            <rect x="20" y="20" width="120" height="100" rx="6" fill="#1f2733" stroke="#ffb74d" stroke-width="1.8"/>
            <!-- 초음파 본딩 툴 헤드 -->
            <polygon points="72,32 88,32 84,65 76,65" fill="#78909c" stroke="#cfd8dc"/>
            <line x1="80" y1="65" x2="80" y2="82" stroke="#ffb74d" stroke-width="2"/>
            <!-- 마이크로 본딩 와이어 루프 / 플립칩 범프 -->
            <path d="M 68 85 Q 74 72 80 82 Q 86 72 92 85" fill="none" stroke="#ffd54f" stroke-width="1.8"/>
            <!-- 리드프레임 / PCB 기판 스테이지 -->
            <rect x="40" y="86" width="80" height="12" rx="2" fill="#2e7d32" stroke="#81c784"/>
            <rect x="70" y="84" width="20" height="4" fill="#424242"/>
            <!-- 상태 LED -->
            <circle cx="128" cy="28" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `,

    // 10. 전기 / 발광 / 외관 검사기 (ATE Tester / EL Inspection)
    tester: (status = 'normal', label = '자동 검사기') => `
        <svg viewBox="0 0 160 140" class="eq-svg ${status}">
            <!-- 검사기 프레임 -->
            <rect x="18" y="18" width="124" height="104" rx="6" fill="#17222d" stroke="#29b6f6" stroke-width="2"/>
            <!-- 프로브 카드 또는 고해상도 머신비전 카메라 -->
            <circle cx="80" cy="45" r="16" fill="#0b131a" stroke="#29b6f6" stroke-width="2"/>
            <circle cx="80" cy="45" r="8" fill="#4fc3f7"/>
            <circle cx="80" cy="45" r="3" fill="#ffffff"/>
            <!-- 검사 조명 LED 링 -->
            <circle cx="68" cy="38" r="1.5" fill="#ffeb3b"/>
            <circle cx="92" cy="38" r="1.5" fill="#ffeb3b"/>
            <circle cx="68" cy="52" r="1.5" fill="#ffeb3b"/>
            <circle cx="92" cy="52" r="1.5" fill="#ffeb3b"/>
            <!-- 검사 대상 시편 플레이트 (웨이퍼/패널) -->
            <rect x="42" y="80" width="76" height="20" rx="3" fill="#263238" stroke="#607d8b"/>
            <line x1="52" y1="90" x2="108" y2="90" stroke="#00e676" stroke-width="2" stroke-dasharray="4,2"/>
            <!-- 상태 LED -->
            <circle cx="130" cy="28" r="5" class="status-led ${status}"/>
            <text x="80" y="132" text-anchor="middle" class="eq-subtext">${label}</text>
        </svg>
    `
};

// 공정 단계별 SVG 매핑 헬퍼 함수
function getEquipmentSVG(industry, stageSeq, status = 'normal', label = '') {
    if (industry === 'SEMICONDUCTOR') {
        switch (stageSeq) {
            case 1: return EquipmentSVGs.cleaner(status, label || '1. 세정조');
            case 2: return EquipmentSVGs.furnace(status, label || '2. 열처리로');
            case 3: return EquipmentSVGs.evaporator(status, label || '3. 증착기');
            case 4: return EquipmentSVGs.photolithography(status, label || '4. 노광기');
            case 5: return EquipmentSVGs.etcher(status, label || '5. 식각기');
            case 6: return EquipmentSVGs.implanter(status, label || '6. 이온주입기');
            case 7: return EquipmentSVGs.cmp(status, label || '7. CMP연마기');
            case 8: return EquipmentSVGs.dicer(status, label || '8. 절단기');
            case 9: return EquipmentSVGs.bonder(status, label || '9. 패키징기');
            case 10: return EquipmentSVGs.tester(status, label || '10. 전기검사기');
            default: return EquipmentSVGs.tester(status, label);
        }
    } else { // OLED
        switch (stageSeq) {
            case 1: return EquipmentSVGs.cleaner(status, label || '1. 기판세정');
            case 2: return EquipmentSVGs.evaporator(status, label || '2. TFT증착');
            case 3: return EquipmentSVGs.photolithography(status, label || '3. TFT노광');
            case 4: return EquipmentSVGs.etcher(status, label || '4. TFT식각');
            case 5: return EquipmentSVGs.evaporator(status, label || '5. OLED증착');
            case 6: return EquipmentSVGs.furnace(status, label || '6. TFE봉지');
            case 7: return EquipmentSVGs.tester(status, label || '7. 발광검사');
            case 8: return EquipmentSVGs.dicer(status, label || '8. 셀절단');
            case 9: return EquipmentSVGs.bonder(status, label || '9. 구동부접합');
            case 10: return EquipmentSVGs.tester(status, label || '10. 모듈검사');
            default: return EquipmentSVGs.tester(status, label);
        }
    }
}

if (typeof window !== 'undefined') {
    window.EquipmentSVGs = EquipmentSVGs;
    window.getEquipmentSVG = getEquipmentSVG;
}
