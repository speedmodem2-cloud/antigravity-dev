# Phase 0 검증 결과 — 2026-04-13

## 요약

**옵션 E (Whisper + Silero VAD 하이브리드) 채택 확정.** Whisper 단독으로는 한국어 필러(특히 "음") 보존이 불가능. 대신 오디오 레벨에서 hesitation hotspot을 탐지하는 경로로 우회.

## 검증한 것들

| 옵션                              | 결과         | 비고                                                       |
| --------------------------------- | ------------ | ---------------------------------------------------------- |
| Whisper large-v3 단독             | ❌ 부분 실패 | "음" 0% 보존, "막/이제" 불안정. "어/그/뭐/그러니까"는 잡음 |
| wav2vec2 (kresnik) 하이브리드     | ❌ 기각      | 필러 보존 더 나쁨 + 일반 단어 정확도 박살. 모델 삭제함     |
| Whisper + initial_prompt 트릭     | ❌ 역효과    | 필러 11→8로 오히려 감소                                    |
| **Whisper + Silero VAD (옵션 E)** | ✅ **채택**  | Whisper=텍스트/의미적 필러, VAD=hesitation hotspot         |

## 옵션 E 실측 메트릭 (test1.m4a, 31.6초)

- 발화 75% / 침묵 25%
- Hotspot 4개 (앞뒤 false positive 2개 제외하면 실질 2개)
- CPM 171
- CPU 처리 35초 (1.1x realtime). GPU 활성화 시 10x 예상.

## 핵심 통찰

1. **Whisper는 "의미 있는 필러"는 잡지만 "순수 disfluency"(음)는 학습 단계에서 제거됨** — 프롬프트 튜닝으로 해결 불가
2. **훈련 목적에 더 직접적인 지표는 "어디서 얼마나 막혔는지"** — hesitation hotspot이 필러 카운트보다 나음
3. **False positive 필터 규칙 필요**: 첫 음성 시작 전 / 마지막 음성 종료 후 무음은 제외

## 환경 상태

- Python: 3.11.14 (uv venv)
- 설치됨: faster-whisper 1.2.1, ctranslate2 4.7.1, torch 2.11.0 (CPU), silero-vad 6.2.1, librosa, transformers
- GPU: RTX 2060 인식됨, but CUDA 12 런타임 미설치 → 현재 CPU 모드
- 모델 캐시: faster-whisper large-v3 (~3GB) 다운로드 완료

## 다음 세션 할 일

1. 2차 계획서 작성 (옵션 E 반영)
2. False positive 필터 로직 구체화
3. GPU 활성화 (CUDA 12 런타임 설치) — 선택, Phase 1 속도에 영향
4. Phase 1 구조 결정 후 실제 구현 시작

## 파일

- `test.py` — Whisper 단독 테스트 (베이스라인 확인용, 유지)
- `test_vad.py` — 옵션 E 통합 테스트 (Phase 1의 프로토타입 역할)
- `audio/test1.m4a` — 테스트 녹음 (필러 의도적 삽입, 31.6초)
