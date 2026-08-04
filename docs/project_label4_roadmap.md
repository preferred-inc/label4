---
name: Label4 技術ロードマップ
description: Label4の将来的なAstro移行・Stripe課金導入の方針
type: project
originSessionId: 1c9172ef-b1d6-47f4-93da-5fd2eb1dfc9a
---
現在はプレーンHTML/CSS/JSでGitHub Pages運用。
将来Pro版（認証・課金）を入れる際にAstro + Stripeへ移行予定。

**Why:** ブログ記事が増えたりPro版の認証・決済が必要になるフェーズで移行する。今の段階ではフレームワークのオーバーヘッドが見合わない。
**How to apply:** 機能追加時にフレームワーク移行のタイミングを意識する。コードはなるべくモジュラーに保ち、移行コストを下げておく。
