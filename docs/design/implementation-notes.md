# Design implementation notes

Reference: `concept.png`, generated with the built-in Image Gen tool for this implementation.

Direction: white surfaces on cool gray, navy navigation, teal calculation accents, compact Japanese forms, two side-by-side Pokémon panels on desktop. Mobile stacks the two panels and places the same three navigation actions above them. Controls and all results are native HTML/React, not a screenshot.

## Intentional functional differences from the concept

- Concept sample EVs included 252 and example damage values. Replaced with real 0–32 ability points, live stats and actual calculated results.
- Neutral nature is まじめ. Initial attacker uses いじっぱり and no item. The supplied availability CSV does not mark サーフゴー available, so the initial all-Pokémon filter is unchecked and a reference-calculation note appears.
- Added point totals, derived stats, held-item/ability descriptions and a current-conditions warning to prevent invalid or stale results.
- Mega controls only appear for eligible Pokémon and select the actual corresponding Mega Stone.
- Comparison rows are paginated 12 at a time (all 72 are available), each damage cell expands its rolls. The separate 16-roll panel is collapsed initially to leave the comparison visible sooner.
- Added inverse observations and saved-history surfaces required by the task. No external artwork or web fonts are required.

## Fidelity ledger

| Point | Reference | Implementation |
|---|---|---|
| Palette | navy rail, teal primary, white panels | same palette; no image overlay or decorative gradient |
| Layout | paired attack/defense panels | retained; single column on narrow devices |
| Typography | bold page heading and result, readable forms | explicit Japanese system font sizes; number alignment and tabular numerals |
| Controls | search/select fields, Mega switch, battle-condition bar | real keyboard-accessible controls; matching field hierarchy |
| Results | teal percentage, HP bar, comparison table | real result range, inner dark min / light max HP bar, table |
| Branding | two-line wordmark | fixed accidental third-line wrapping with nowrap |
| Data display | comparison HP-point column | fixed accidental collision between maximum HP and HP-point fields |

Above-the-fold copy preserves the main navigation and field labels. Additional copy is restricted to required input help, validation, current conditions and real data labels. The screenshot concept is not a source of numerical game data.

Final browser pass: Codex in-app browser, desktop viewport 1440×1100 and mobile 390×844 (content width excludes the scrollbar). No page-level horizontal overflow, framework overlays, or relevant console errors. Verified 72 rows, Mega form and stone linkage, held-item changes, 100→20% inference (92 candidates / 89 groups), history persistence and restoration. Compared the concept and final browser captures with `view_image`; layout, palette, typography hierarchy, form controls, result emphasis, branding and responsive stacking were inspected. Intentional differences are listed above.

## ランキング追加と公開版の確認（2026-09-12）
- ランキング242件、検索、メガ進化・イルカマンのフォルム切り替えを公開版で確認。
- PC 1440px / スマホ390pxで確認。横方向の画面あふれなし。スマホの4タブはアイコンと文字を縦並びに調整。
- 公開版の逆算ワーカーで100%→20%から92候補・89グループを確認。ブラウザのエラー・警告なし。
- 自動テスト17件成功。CSV差し替え、順位ソート、不正値、名称対応のテストを追加。
- Viteの公開ビルドはこのWindows環境で変換後に詳細エラーなしで終了。esbuildへ公開処理を移し、CSS・共通モジュール・逆算ワーカーを含めてビルド成功。
- Browser plugin not available; CUA経由のPlaywrightで確認。
