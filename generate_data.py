#!/usr/bin/env python3
"""
AURORA Industrial Intelligence - Synthetic Dataset & Profile Generator
PRD v1.0 규격 준수:
- 10,000행 44컬럼 제조 합성 데이터셋 생성 (반도체 5,000행, OLED 5,000행)
- 1,000개 로트 (반도체 500개, OLED 500개) 각 10단계 공정 순차 실행
- process_profiles.csv: 20대 공정 기준 사양서 및 허용 공차
"""

import csv
import random
import math
from datetime import datetime, timedelta

random.seed(42)

# 공정 정의
SEMI_STAGES = [
    {"seq": 1, "code": "CLN", "name": "세정", "eq_id": "EQ_SEMI_01", "eq_name": "웨이퍼 고순도 세정조", "chamber": "CH_CLN_01", "temp": (25, 2), "press": (760, 5), "power": (0, 0), "gas": (500, 20), "param": "파티클 잔류 밀도 (ea/cm²)", "target": 0.05, "half_width": 0.03},
    {"seq": 2, "code": "ANN", "name": "열처리", "eq_id": "EQ_SEMI_02", "eq_name": "종형 급속 열처리로(RTP)", "chamber": "CH_ANN_01", "temp": (950, 15), "press": (750, 10), "power": (1200, 30), "gas": (2000, 50), "param": "산화막 두께 (nm)", "target": 45.0, "half_width": 2.5},
    {"seq": 3, "code": "DEP", "name": "증착", "eq_id": "EQ_SEMI_03", "eq_name": "PECVD 플라즈마 증착기", "chamber": "CH_DEP_01", "temp": (400, 8), "press": (2.5, 0.2), "power": (2500, 50), "gas": (1500, 40), "param": "박막 증착 균일도 (%)", "target": 98.5, "half_width": 1.2},
    {"seq": 4, "code": "PHO", "name": "포토", "eq_id": "EQ_SEMI_04", "eq_name": "EUV/ArF 노광 스캐너", "chamber": "CH_PHO_01", "temp": (23, 0.5), "press": (760, 2), "power": (800, 10), "gas": (100, 5), "param": "선폭(CD) 임계치수 (nm)", "target": 14.0, "half_width": 0.8},
    {"seq": 5, "code": "ETC", "name": "식각", "eq_id": "EQ_SEMI_05", "eq_name": "ICP 고밀도 플라즈마 식각기", "chamber": "CH_ETC_01", "temp": (65, 3), "press": (15.0, 1.2), "power": (3200, 80), "gas": (800, 25), "param": "식각 깊이 (nm)", "target": 220.0, "half_width": 12.0},
    {"seq": 6, "code": "IMP", "name": "이온주입", "eq_id": "EQ_SEMI_06", "eq_name": "고전류 이온주입기", "chamber": "CH_IMP_01", "temp": (28, 2), "press": (0.005, 0.001), "power": (4500, 100), "gas": (50, 2), "param": "도핑 면저항 (ohm/sq)", "target": 85.0, "half_width": 4.5},
    {"seq": 7, "code": "CMP", "name": "CMP", "eq_id": "EQ_SEMI_07", "eq_name": "화학기계적 연마기(CMP)", "chamber": "CH_CMP_01", "temp": (32, 2), "press": (3.5, 0.3), "power": (1500, 40), "gas": (200, 10), "param": "잔류 단차 조도 (A)", "target": 12.0, "half_width": 2.0},
    {"seq": 8, "code": "DIC", "name": "박막화·절단", "eq_id": "EQ_SEMI_08", "eq_name": "정밀 레이저 다이싱기", "chamber": "CH_DIC_01", "temp": (24, 1), "press": (760, 5), "power": (600, 15), "gas": (300, 15), "param": "커프 폭 편차 (um)", "target": 18.0, "half_width": 1.5},
    {"seq": 9, "code": "PKG", "name": "패키징", "eq_id": "EQ_SEMI_09", "eq_name": "플립칩 고속 본더", "chamber": "CH_PKG_01", "temp": (180, 5), "press": (760, 5), "power": (950, 20), "gas": (400, 20), "param": "볼 본딩 접합강도 (gf)", "target": 65.0, "half_width": 4.0},
    {"seq": 10, "code": "EDS", "name": "전기검사", "eq_id": "EQ_SEMI_10", "eq_name": "초정밀 자동 웨이퍼 테스터(ATE)", "chamber": "CH_EDS_01", "temp": (25, 1), "press": (760, 5), "power": (500, 10), "gas": (100, 5), "param": "동작 전압 편차 (mV)", "target": 1200.0, "half_width": 35.0}
]

OLED_STAGES = [
    {"seq": 1, "code": "SCL", "name": "기판세정", "eq_id": "EQ_OLED_01", "eq_name": "대형 글래스 정밀 초음파 세정기", "chamber": "CH_SCL_01", "temp": (45, 2), "press": (760, 5), "power": (400, 15), "gas": (800, 30), "param": "유기 오염 잔류도 (deg)", "target": 5.0, "half_width": 1.5},
    {"seq": 2, "code": "TDEP", "name": "TFT 증착", "eq_id": "EQ_OLED_02", "eq_name": "TFT 인라인 스퍼터링기", "chamber": "CH_TDEP_01", "temp": (280, 6), "press": (1.2, 0.1), "power": (3800, 60), "gas": (1200, 30), "param": "IGZO 채널 두께 (nm)", "target": 50.0, "half_width": 3.0},
    {"seq": 3, "code": "TPHO", "name": "TFT 포토", "eq_id": "EQ_OLED_03", "eq_name": "대면적 TFT 프로젝션 노광기", "chamber": "CH_TPHO_01", "temp": (22, 0.5), "press": (760, 2), "power": (1100, 20), "gas": (150, 8), "param": "TFT 게이트 선폭 (um)", "target": 2.5, "half_width": 0.2},
    {"seq": 4, "code": "TETC", "name": "TFT 식각", "eq_id": "EQ_OLED_04", "eq_name": "대형 건식 에처(Dry Etcher)", "chamber": "CH_TETC_01", "temp": (55, 3), "press": (20.0, 1.5), "power": (2900, 70), "gas": (900, 30), "param": "테이퍼 각도 (deg)", "target": 55.0, "half_width": 3.5},
    {"seq": 5, "code": "OEV", "name": "OLED 증착", "eq_id": "EQ_OLED_05", "eq_name": "진공 열증착기(FMM Evaporator)", "chamber": "CH_OEV_01", "temp": (320, 5), "press": (0.0001, 0.00002), "power": (4200, 90), "gas": (20, 2), "param": "발광층 유기물 두께 (A)", "target": 350.0, "half_width": 18.0},
    {"seq": 6, "code": "ENC", "name": "봉지", "eq_id": "EQ_OLED_06", "eq_name": "TFE 무기/유기 박막 봉지기", "chamber": "CH_ENC_01", "temp": (80, 3), "press": (0.5, 0.05), "power": (1800, 40), "gas": (450, 15), "param": "수분투과율(WVTR) (g/m²/day)", "target": 0.00001, "half_width": 0.000005},
    {"seq": 7, "code": "ELT", "name": "발광검사", "eq_id": "EQ_OLED_07", "eq_name": "고해상도 광학 EL 에이징 검사기", "chamber": "CH_ELT_01", "temp": (24, 1), "press": (760, 5), "power": (650, 15), "gas": (100, 5), "param": "휘도 균일도 (%)", "target": 95.0, "half_width": 2.0},
    {"seq": 8, "code": "CUT", "name": "절단·분리", "eq_id": "EQ_OLED_08", "eq_name": "울트라패스트 레이저 셀 절단기", "chamber": "CH_CUT_01", "temp": (23, 1), "press": (760, 5), "power": (850, 20), "gas": (350, 15), "param": "셀 절단 치수 공차 (um)", "target": 10.0, "half_width": 1.2},
    {"seq": 9, "code": "BND", "name": "구동부 접합", "eq_id": "EQ_OLED_09", "eq_name": "COP/COG 정밀 본딩기", "chamber": "CH_BND_01", "temp": (195, 4), "press": (4.2, 0.3), "power": (1200, 25), "gas": (300, 15), "param": "범프 압흔 단자 저항 (mohm)", "target": 45.0, "half_width": 3.8},
    {"seq": 10, "code": "MOD", "name": "모듈 조립·검사", "eq_id": "EQ_OLED_10", "eq_name": "최종 완성 패널 비전 검사기", "chamber": "CH_MOD_01", "temp": (25, 1), "press": (760, 5), "power": (550, 10), "gas": (100, 5), "param": "색좌표 편차 deltaE", "target": 1.2, "half_width": 0.35}
]

def generate_process_profiles():
    """process_profiles.csv 생성"""
    with open("process_profiles.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "industry", "stage_seq", "stage_code", "stage_name", "equipment_id", "equipment_name",
            "chamber_id", "param_name", "target_value", "tolerance_half_width", "usl", "lsl",
            "temp_nominal_c", "press_nominal_mtorr", "rf_power_nominal_w", "gas_nominal_sccm",
            "cycle_time_nominal_sec", "representative_defect_mode"
        ])
        
        for p in SEMI_STAGES:
            writer.writerow([
                "SEMICONDUCTOR", p["seq"], p["code"], p["name"], p["eq_id"], p["eq_name"],
                p["chamber"], p["param"], p["target"], p["half_width"], p["target"] + p["half_width"], p["target"] - p["half_width"],
                p["temp"][0], p["press"][0], p["power"][0], p["gas"][0],
                random.randint(45, 120), f"{p['name']} 불균일 및 규격 이탈"
            ])
            
        for p in OLED_STAGES:
            writer.writerow([
                "OLED", p["seq"], p["code"], p["name"], p["eq_id"], p["eq_name"],
                p["chamber"], p["param"], p["target"], p["half_width"], p["target"] + p["half_width"], p["target"] - p["half_width"],
                p["temp"][0], p["press"][0], p["power"][0], p["gas"][0],
                random.randint(40, 110), f"{p['name']} 박리 및 치수 변형"
            ])
    print("[OK] process_profiles.csv created (20 profiles).")

def generate_synthetic_dataset():
    """process_optimization_synthetic_10000.csv 생성 (10,000행 44컬럼)"""
    start_date = datetime(2027, 1, 1, 8, 0, 0)
    
    headers = [
        "record_id", "timestamp", "tenant_id", "site_id", "industry", "line_id",
        "lot_id", "product_id", "recipe_id", "stage_seq", "stage_name", "equipment_id",
        "equipment_name", "chamber_id", "start_time", "end_time", "process_time_sec",
        "queue_time_sec", "input_qty", "good_qty", "defect_qty", "rework_qty",
        "temp_setpoint_c", "temp_measured_c", "pressure_setpoint_mtorr", "pressure_measured_mtorr",
        "rf_power_w", "gas_flow_sccm", "rotation_rpm", "chemical_ph", "vibration_rms_g",
        "energy_consumed_kwh", "water_usage_l", "communication_status", "packet_loss_rate",
        "latency_ms", "data_quality_flag", "measurement_param", "measured_value",
        "target_spec", "tolerance_half_width", "normalized_quality_dev", "spec_out_flag", "operator_id"
    ]
    
    records = []
    rec_counter = 1
    
    # 1. 반도체 500 로트 (5,000 레코드)
    for lot_idx in range(1, 501):
        lot_id = f"SEMI_LOT_{lot_idx:04d}"
        lot_start = start_date + timedelta(hours=(lot_idx - 1) * 2.0 + random.uniform(-0.5, 0.5))
        curr_time = lot_start
        lot_input = 25  # 웨이퍼 25장 FOUP
        
        for st in SEMI_STAGES:
            rec_id = f"REC_{rec_counter:05d}"
            rec_counter += 1
            
            queue_sec = int(random.expovariate(1.0 / 900.0)) + 60 # 평균 15분 대기
            proc_sec = random.randint(45, 120)
            st_start = curr_time + timedelta(seconds=queue_sec)
            st_end = st_start + timedelta(seconds=proc_sec)
            curr_time = st_end
            
            # 물리 파라미터 변동
            t_set, t_std = st["temp"]
            t_meas = round(random.gauss(t_set, t_std), 2)
            
            p_set, p_std = st["press"]
            p_meas = round(random.gauss(p_set, p_std), 4)
            
            rf_set, rf_std = st["power"]
            rf_meas = round(random.gauss(rf_set, rf_std), 1) if rf_set > 0 else 0.0
            
            gas_set, gas_std = st["gas"]
            gas_meas = round(random.gauss(gas_set, gas_std), 1)
            
            rpm = random.randint(800, 2400) if "CMP" in st["code"] or "CLN" in st["code"] else 0
            ph = round(random.uniform(6.8, 7.4), 2) if "CLN" in st["code"] or "CMP" in st["code"] else 7.0
            vib = round(random.uniform(0.015, 0.085), 4)
            energy = round(random.uniform(1.2, 5.8), 2)
            water = round(random.uniform(10.0, 45.0), 1) if "CLN" in st["code"] or "CMP" in st["code"] else 0.0
            
            # 통신 품질 (금속 차폐 통신)
            comm_rand = random.random()
            if comm_rand > 0.96:
                comm_status = "DELAYED"
                pkt_loss = round(random.uniform(1.5, 4.8), 2)
                latency = round(random.uniform(45.0, 180.0), 1)
            elif comm_rand > 0.995:
                comm_status = "DISCONNECTED"
                pkt_loss = round(random.uniform(8.0, 25.0), 2)
                latency = round(random.uniform(250.0, 1200.0), 1)
            else:
                comm_status = "NORMAL"
                pkt_loss = round(random.uniform(0.01, 0.4), 2)
                latency = round(random.uniform(8.0, 22.0), 1)
                
            # 품질 타겟 및 편차 생성 (결정론적 영향 + 잡음)
            # 파라미터 편차가 품질 편차를 유발하도록 설계
            temp_dev = (t_meas - t_set) / (t_std if t_std > 0 else 1.0)
            press_dev = (p_meas - p_set) / (p_std if p_std > 0 else 1.0)
            rf_dev = (rf_meas - rf_set) / (rf_std if rf_std > 0 else 1.0) if rf_set > 0 else 0.0
            
            # 정규화 편차 (Z-score 유사)
            underlying_norm_dev = 0.35 * temp_dev + 0.30 * press_dev + 0.25 * rf_dev + random.gauss(0, 0.45)
            norm_dev = round(underlying_norm_dev, 4)
            
            meas_val = round(st["target"] + norm_dev * st["half_width"], 4)
            spec_out = 1 if abs(norm_dev) > 1.0 else 0
            
            # 수량
            defect_cnt = 1 if spec_out and random.random() < 0.6 else 0
            rework_cnt = 1 if spec_out and defect_cnt == 0 and random.random() < 0.5 else 0
            good_cnt = lot_input - defect_cnt - rework_cnt
            
            dq_flag = "VALID" if abs(norm_dev) < 2.5 else ("WARNING" if abs(norm_dev) < 3.5 else "ANOMALY")
            
            row = [
                rec_id, st_start.strftime("%Y-%m-%dT%H:%M:%SZ"), "SUNNY_IND", "SITE_PYEONGTAEK", "SEMICONDUCTOR", "FAB1_LINE_A",
                lot_id, "SEMI_CHIP_V1", f"RCP_{st['code']}_01", st["seq"], st["name"], st["eq_id"],
                st["eq_name"], st["chamber"], st_start.strftime("%Y-%m-%dT%H:%M:%SZ"), st_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                proc_sec, queue_sec, lot_input, good_cnt, defect_cnt, rework_cnt,
                t_set, t_meas, p_set, p_meas, rf_set, gas_set, rpm, ph, vib,
                energy, water, comm_status, pkt_loss, latency, dq_flag,
                st["param"], meas_val, st["target"], st["half_width"], norm_dev, spec_out, f"OP_SEMI_{random.randint(101, 115)}"
            ]
            records.append(row)

    # 2. OLED 500 로트 (5,000 레코드)
    for lot_idx in range(1, 501):
        lot_id = f"OLED_LOT_{lot_idx:04d}"
        lot_start = start_date + timedelta(hours=(lot_idx - 1) * 2.0 + random.uniform(-0.5, 0.5))
        curr_time = lot_start
        lot_input = 100  # 패널 100장 카세트
        
        for st in OLED_STAGES:
            rec_id = f"REC_{rec_counter:05d}"
            rec_counter += 1
            
            queue_sec = int(random.expovariate(1.0 / 800.0)) + 45 # 평균 13분 대기
            proc_sec = random.randint(40, 110)
            st_start = curr_time + timedelta(seconds=queue_sec)
            st_end = st_start + timedelta(seconds=proc_sec)
            curr_time = st_end
            
            t_set, t_std = st["temp"]
            t_meas = round(random.gauss(t_set, t_std), 2)
            
            p_set, p_std = st["press"]
            p_meas = round(random.gauss(p_set, p_std), 6)
            
            rf_set, rf_std = st["power"]
            rf_meas = round(random.gauss(rf_set, rf_std), 1) if rf_set > 0 else 0.0
            
            gas_set, gas_std = st["gas"]
            gas_meas = round(random.gauss(gas_set, gas_std), 1)
            
            rpm = random.randint(600, 1800) if "SCL" in st["code"] else 0
            ph = round(random.uniform(6.5, 7.5), 2) if "SCL" in st["code"] else 7.0
            vib = round(random.uniform(0.012, 0.078), 4)
            energy = round(random.uniform(1.5, 6.2), 2)
            water = round(random.uniform(15.0, 50.0), 1) if "SCL" in st["code"] else 0.0
            
            comm_rand = random.random()
            if comm_rand > 0.96:
                comm_status = "DELAYED"
                pkt_loss = round(random.uniform(1.2, 4.2), 2)
                latency = round(random.uniform(40.0, 160.0), 1)
            elif comm_rand > 0.995:
                comm_status = "DISCONNECTED"
                pkt_loss = round(random.uniform(6.0, 20.0), 2)
                latency = round(random.uniform(220.0, 1000.0), 1)
            else:
                comm_status = "NORMAL"
                pkt_loss = round(random.uniform(0.01, 0.35), 2)
                latency = round(random.uniform(7.0, 20.0), 1)
                
            temp_dev = (t_meas - t_set) / (t_std if t_std > 0 else 1.0)
            press_dev = (p_meas - p_set) / (p_std if p_std > 0 else 1.0)
            rf_dev = (rf_meas - rf_set) / (rf_std if rf_std > 0 else 1.0) if rf_set > 0 else 0.0
            
            underlying_norm_dev = 0.38 * temp_dev + 0.32 * press_dev + 0.22 * rf_dev + random.gauss(0, 0.44)
            norm_dev = round(underlying_norm_dev, 4)
            
            meas_val = round(st["target"] + norm_dev * st["half_width"], 6)
            spec_out = 1 if abs(norm_dev) > 1.0 else 0
            
            defect_cnt = random.randint(1, 3) if spec_out and random.random() < 0.65 else 0
            rework_cnt = random.randint(1, 2) if spec_out and defect_cnt == 0 and random.random() < 0.5 else 0
            good_cnt = lot_input - defect_cnt - rework_cnt
            
            dq_flag = "VALID" if abs(norm_dev) < 2.5 else ("WARNING" if abs(norm_dev) < 3.5 else "ANOMALY")
            
            row = [
                rec_id, st_start.strftime("%Y-%m-%dT%H:%M:%SZ"), "SUNNY_IND", "SITE_ASAN", "OLED", "FAB2_LINE_B",
                lot_id, "OLED_PANEL_GEN6", f"RCP_{st['code']}_01", st["seq"], st["name"], st["eq_id"],
                st["eq_name"], st["chamber"], st_start.strftime("%Y-%m-%dT%H:%M:%SZ"), st_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                proc_sec, queue_sec, lot_input, good_cnt, defect_cnt, rework_cnt,
                t_set, t_meas, p_set, p_meas, rf_set, gas_set, rpm, ph, vib,
                energy, water, comm_status, pkt_loss, latency, dq_flag,
                st["param"], meas_val, st["target"], st["half_width"], norm_dev, spec_out, f"OP_OLED_{random.randint(201, 215)}"
            ]
            records.append(row)
            
    with open("process_optimization_synthetic_10000.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(records)
        
    print(f"[OK] process_optimization_synthetic_10000.csv created ({len(records)} rows, {len(headers)} columns).")

if __name__ == "__main__":
    generate_process_profiles()
    generate_synthetic_dataset()
