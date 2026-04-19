---
name: gemini_chat 활용 긍정 피드백
description: 디버깅 막힐 때 gemini_chat에 상세 컨텍스트 넘겨서 2nd opinion 받는 패턴을 유저가 좋아함
type: feedback
---

디버깅이 막히거나 원인 파악이 어려울 때 gemini_chat에 상세한 환경정보 + 시도내역 + 질문을 구조화해서 보내는 패턴을 유저가 매우 긍정적으로 평가함.

**Why:** PS Remote Play 크래시 디버깅에서 여러 시도가 실패한 후, Gemini에게 상세 프롬프트를 보내 Intel iGPU 드라이버가 근본 원인이라는 핵심 인사이트를 얻음. 유저가 "너무 마음에 든다"고 직접 언급.

**How to apply:** 문제 해결이 3회 이상 실패하거나 근본 원인이 불확실할 때, gemini_chat에 환경/로그/시도내역을 구조화하여 2nd opinion을 적극적으로 요청. 유저 허락 없이 자체 판단으로 호출해도 OK.
