/**
 * @file patch_v4.js
 * @description 给 rainbow-predictor-v4.html 加入蒙特卡洛期望计算器
 * @author Fisheep.L
 */
// patch_v4.js — 给 rainbow-predictor-v4.html 加入蒙特卡洛期望计算器
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'rainbow-predictor-v4.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// ── 1. 替换 calcSkipMapAnalysis 的 return 部分，加入 nextMapCardStepBonus ──
const oldReturn = `    firstCardDist:firstCardDist>0?firstCardDist:null,
    nextMapCardProb,
  };
}

// ============================================================
// STRATEGY REPORT GENERATOR`;

const newReturn = `    firstCardDist:firstCardDist>0?firstCardDist:null,
    nextMapCardProb,
    // Expected step bonus from cards in next map
    nextMapCardStepBonus: cardTileCount * 7,
  };
}

// ============================================================
// EXPECTATION ENGINE — Monte Carlo per-card simulation
// ============================================================
const SIM_DICE = 6;          // dice rolls to simulate after using card
const MONTE_RUNS = 300;     // simulation count per card

function simOneRun(startPos) {
  let pos = startPos;
  for (let d = 0; d < SIM_DICE; d++) {
    let dice = 1 + Math.floor(Math.random() * 6);
    pos += dice;
    if (pos > 2898) break;
    if (pos < 1) pos = 1;
    let wt = TILE_DATA[pos - 1];
    if (wt && WARP_CATS.includes(wt.c) && wt.f) pos = wt.f;
    let lt = TILE_DATA[pos - 1];
    if (lt && lt.c === 'CARD') {
      // 70% chance to get a step card
      if (Math.random() < 0.70) {
        let sv = [3,5,8,9,10][Math.floor(Math.random()*5)];
        pos += sv;
        if (pos > 2898) break;
        if (pos < 1) pos = 1;
        let wt2 = TILE_DATA[pos - 1];
        if (wt2 && WARP_CATS.includes(wt2.c) && wt2.f) pos = wt2.f;
      }
    }
  }
  return pos;
}

function calcCardExpectation(ck, pos) {
  let ct = getCardInfo(ck);
  if (!ct) return null;
  let simPos = pos;

  if (ct.cat === 'step' && ct.step) {
    simPos += ct.step;
    if (simPos > 2898) simPos = 2898;
    if (simPos < 1) simPos = 1;
    let wt = TILE_DATA[simPos - 1];
    if (wt && WARP_CATS.includes(wt.c) && wt.f) simPos = wt.f;
  } else if (ct.cat === 'skip') {
    let skip = calcSkipMapAnalysis(pos);
    if (skip) simPos = skip.startPos;
    else return { score: 0, avgFinalPos: pos, detail: '无下一关可跳' };
  } else if (ct.cat === 'mult') {
    return { score: -1, avgFinalPos: pos, detail: '倍数卡不直接增加步数（积分优先时用）' };
  } else {
    return null;
  }

  let total = 0, valid = 0;
  for (let s = 0; s < MONTE_RUNS; s++) {
    let fp = simOneRun(simPos);
    if (fp >= pos) { total += fp; valid++; }
  }
  if (valid === 0) return { score: 0, avgFinalPos: pos, detail: '模拟异常' };
  let avg = total / valid;
  let score = avg - pos;
  let emo = ct.emoji || '🃏';
  let detail = score > 0
    ? emo + ' ' + ct.name + ': 期望最终位置 <b>第' + Math.round(avg) + '格</b> · 期望推进 <b style="color:var(--gold);">+' + score.toFixed(1) + '</b>步'
    : emo + ' ' + ct.name + ': 期望推进不明显';
  return { ck, score, avgFinalPos: Math.round(avg), detail };
}

function computeAllExpectations(pos) {
  let results = [];
  for (let ck of heldCards) {
    let r = calcCardExpectation(ck, pos);
    if (r) results.push(r);
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ============================================================
// STRATEGY REPORT GENERATOR`;

if (html.includes(oldReturn)) {
  html = html.replace(oldReturn, newReturn);
  console.log('✅ 期望计算器已插入');
} else {
  console.log('⚠️  未找到插入点，尝试备用方案...');
  // 备用：在 calcSkipMapAnalysis 函数结束后插入
}

// ── 2. 在 generateReportData 的 hero 部分加入期望分析 ──
const heroMarker = `  // ── Compute all priorities ───────────────────────────────`;
const expectationInsert = `  // ── Expectation analysis (Monte Carlo) ─────────────────
  let expectResults = computeAllExpectations(pos);
  let expectHTML = '';
  if (expectResults.length > 0 && expectResults[0].score > 0) {
    expectHTML += '<div class="rec-section">🎯 期望步数分析（CPU模拟中...）</div>';
    for (let r of expectResults) {
      if (r.score <= 0) continue;
      let cls = r === expectResults[0] ? 'priority' : '';
      expectHTML += '<div class="rec-item ' + cls + '">' + r.detail + '</div>';
    }
    expectHTML += '<div style="font-size:0.78em;color:var(--text2);margin-top:4px;">模拟参数: 每卡' + MONTE_RUNS + '次随机序列 × 后续' + SIM_DICE + '次骰子</div>';
  }
`;

if (html.includes(heroMarker) && !html.includes('expectResults')) {
  html = html.replace(heroMarker, expectationInsert + heroMarker);
  console.log('✅ 期望分析已加入策略报告');
} else {
  console.log('⚠️  期望分析插入失败（可能已存在）');
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✅ 文件已更新: ' + htmlPath);
