#!/usr/bin/env python3
"""
AURORA Industrial Intelligence - Development & Serving Server
PRD v1.0 호환:
- 순수 Python 표준 라이브러리 기반 로컬 웹서버
- dist/ 폴더의 정적 파일 (HTML, CSS, JS, JSON) 및 CSV 서빙
- RESTful API 지원 (/api/metrics, /api/tasks, /api/status)
"""

import os
import sys
import json
import csv
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class AuroraHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # CORS 및 캐시 방지 헤더
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        # 루트 URL 접근 시 dist/index.html로 리다이렉트
        if self.path == "/" or self.path == "":
            self.send_response(302)
            self.send_header("Location", "/dist/index.html")
            self.end_headers()
            return

        # REST API 엔드포인트
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            status = {
                "service": "AURORA Industrial Intelligence",
                "version": "v1.0",
                "status": "ONLINE",
                "comm_bus": "NORMAL",
                "latency_ms": 12.4,
                "packet_loss_rate": 0.04
            }
            self.wfile.write(json.dumps(status).encode("utf-8"))
            return

        elif self.path == "/api/metrics":
            metrics_path = os.path.join(BASE_DIR, "dist", "model_metrics.json")
            if os.path.exists(metrics_path):
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                with open(metrics_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "model_metrics.json not found")
            return

        return super().do_GET()

def run_server():
    ports_to_try = [8000, 8080, 8088, 8888]
    httpd = None
    selected_port = None

    for port in ports_to_try:
        try:
            server_address = ("", port)
            httpd = HTTPServer(server_address, AuroraHTTPRequestHandler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        print("[오류] 가용한 포트를 찾을 수 없습니다.")
        sys.exit(1)

    print("=" * 60)
    print(f"🚀 오로라(AURORA) 제조 운영 지능화 로컬 웹 서버 기동 완료!")
    print(f"👉 브라우저 접속 주소: http://localhost:{selected_port}/dist/index.html")
    print(f"📂 작업 디렉토리: {BASE_DIR}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[서버 정상 종료]")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
