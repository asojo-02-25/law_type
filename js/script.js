// ====================================
// グローバル変数・定数の定義
// ====================================

let questionQueue = [];         // 実際に出題される問題のリスト
let currentQuestionIndex = 0;   // 今何問目か
let chunkedText = [];           // 日本語を読点で区切ったリスト
let chunkedRomaji = [];         // ローマ字をカンマで区切ったリスト
let currentChunkIndex = 0;      // 今何個目の文節を打っているか
let currentTargetRomaji = '';   // 今打つべきローマ字の文節
let inputBuffer = '';           // ユーザーが打っている正誤未確定の文節
let gameStartTime = 0;          // 開始タイムスタンプ
let correctKeyCount = 0;        // 正解タイプ数
let missedKeyCount = 0;         // ミスタイプ数
let missedKeysMap = {};         // ミスタイプしたキーを格納するオブジェクト
let isGameActive = false;       // ゲーム進行中フラグ
let resultChartInstance = null; // 結果チャートのインスタンス保持用
let lastGameSettings = null;    // 直近プレイ設定を保持

// --- 特殊なidへの対応表
const keyIdMap = {
    '-' : 'Minus',
    '^' : 'caret',
    '￥' : 'Yen',
    '@' : 'Atmark',
    '[' : 'BracketLeft',
    ';' : 'SemiColon',
    ':' : 'Colon',
    ']' : 'BracketRight',
    ',' : 'Comma',
    '.' : 'Period',
    '/' : 'Slash',
    '\\' : 'BackSlash',
};

// ====================================
// HTML要素の取得
// ====================================

const form = document.querySelector('#form');
const startScreen = document.querySelector('#start-screen');
const gameScreen = document.querySelector('#game-screen');
const resultsScreen = document.querySelector('#results-screen');
const delayScreens = document.querySelectorAll('.delay-screen');
const btn = document.querySelector('#start-button');
const textElement = document.querySelector('#question-text');
const inputElement = document.querySelector('#user-input');
const guideElement = document.querySelector('#current-guide');
const fieldElement = document.querySelector('#question-field');
const sourceElement  = document.querySelector('#question-source'); 
const questionArea = document.querySelector('.question-area');
const answerArea = document.querySelector('.answer-area');
const keys = document.querySelectorAll('.key');
const statItems = document.querySelectorAll('.stat-item');

// --- 問題を格納する配列のインポート ---
import {typingQuestions} from './question.js';

// ====================================
// ページロード時の初期化
// ====================================

// ページ読み込み時に画面状態をリセット
window.addEventListener('load', () => {
    startScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    resultsScreen.style.display = 'none';
});

// ====================================
// 履歴取得 / 統計計算 ヘルパー
// ====================================

const STORAGE_KEY = 'law_type_play_data';

const getStoredHistory = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
        console.error('storage parse error', e);
        return [];
    }
};

const computeHistoryMetrics = (history) => {
    const count = history.length;
    if (count === 0) {
        return {
            maxWpm: 0,
            recentAvgWpm: 0,
            recentChange: 0,
            initialChange: 0,
            latest: null,
        };
    }

    const wpms = history.map(h => Number(h.wpm));
    const maxWpm = Math.max(...wpms);

    const recentN = Math.min(15, count);
    const recentSlice = wpms.slice(-recentN);
    const recentAvgWpm = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;

    const recentChange = count >= 1 ? (((wpms[count - 1] / recentAvgWpm) - 1) * 100) : 0;

    const initialN = Math.min(15, count);
    const initialAvgWpm = wpms.slice(0, initialN).reduce((a, b) => a + b, 0) / initialN;
    const initialChange = recentAvgWpm - initialAvgWpm;

    const latest = history[count - 1];

    return {
        maxWpm,
        recentAvgWpm,
        recentChange,
        initialChange,
        latest,
    };
};

const displayResultStats = (data) => {
    // html 要素の取得
    const wpmEl = document.getElementById('stat-wpm');
    const accEl = document.getElementById('stat-accuracy');
    const recentChangeEl = document.getElementById('stat-wpm-recent-change');
    const initialrecentChangeEl = document.getElementById('stat-wpm-initial-change');
    const weakEl = document.getElementById('stat-weak-keys');
    const recentAvgEl = document.getElementById('stat-recent-wpm-avg');
    const maxEl = document.getElementById('stat-wpm-max');

    if (wpmEl) wpmEl.textContent = Number(data.wpm).toFixed(2) + ' keys/秒';
    if (accEl) accEl.textContent = Number(data.accuracy).toFixed(1) + ' %';
    if (weakEl) weakEl.textContent = data.weakKey || '特になし';

    const history = getStoredHistory();
    const metrics = computeHistoryMetrics(history);

    if (recentChangeEl) {
        const sign = metrics.recentChange >= 0? '+ ' : '';
        recentChangeEl.textContent = sign + metrics.recentChange.toFixed(1) + ' %';
    }
    if (initialrecentChangeEl) {
        const sign = metrics.initialChange >= 0 ? '+ ' : '';
        initialrecentChangeEl.textContent = sign + metrics.initialChange.toFixed(1) + ' %';
    }
    if (recentAvgEl) recentAvgEl.textContent = metrics.recentAvgWpm.toFixed(2) + ' keys/秒';
    if (maxEl) maxEl.textContent = metrics.maxWpm.toFixed(2) + ' keys/秒';
};

// ====================================
// 補助関数
// ====================================

// --- 設定を取得する関数の定義 ---
const getGameSettings = () => {
    //問題形式
    const format = document.querySelector('input[name="format"]:checked').value;
    //問題数
    const itemcounts = parseInt(document.querySelector('input[name="itemcounts"]:checked').value);
    //各種設定
    const options = [];
    document.querySelectorAll('input[name="setting"]:checked').forEach((checkbox) => {
        options.push(checkbox.value);
    });

    return{
        mode: format,
        questionCounts: itemcounts,
        settings: options,
    };
};

// --- タイプべきキーのハイライト ---
const highlightNextChar = () => {
    // すでにactiveなキーのリセット
    const activeKeys = document.querySelectorAll('.key.active');
    activeKeys.forEach((keys) => {
        keys.classList.remove('active');
    });

    // html要素の取得
    const nextChar = currentTargetRomaji[inputBuffer.length];
    if(!nextChar) return;
    
    // Id の取得 / ターゲット文字のハイライト 
    const targetId = keyIdMap[nextChar] || nextChar.toUpperCase();
    const targetElement = document.getElementById(targetId);
    if(targetElement){
        targetElement.classList.add('active');
    }     
};

// --- ミスタイプしたキーのハイライト ---
const highlightMissedKey = (char) => {
    // id の取得
    const targetId = keyIdMap[char] || char.toUpperCase();
    const targetElement = document.getElementById(targetId);

    // keyframs, options の定義 / アニメーションの実行
    if(targetElement){
        const keyframes = [
            {backgroundColor: 'red', offset: 0},
            {backgroundColor: 'white', offset: 1},
        ];
        const options = {
            duration: 200,
            iterations: 2,
        }
        targetElement.animate(keyframes, options);
    }
};

// --- localStrageへの保存 ---
const saveToLocalStorage = (data) => {
    const history = getStoredHistory();
    history.push(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

// ====================================
// ゲーム開始 (startGame)
// ====================================

const startGame = (config) => {
    isGameActive = true;        // ゲーム開始フラグ
    guideElement.style.display = 'block';

    lastGameSettings = JSON.parse(JSON.stringify(config));  // 直近の設定を保持
    
    console.log("開始設定", config); // 設定の取得・反映確認

    correctKeyCount = 0;
    missedKeyCount = 0;
    missedKeysMap = {};
    gameStartTime = Date.now();

    if(config.settings.includes('roman-letters-represent')){
        console.log("ローマ字を表示します");
    }
    if(config.settings.includes('keyboard-represent')){
        console.log("キーボードを表示します");
    }

    // 問題の出題
    // 問題をシャッフル
    const shuffleArray = (array) => {
        // もとの配列が壊れないようにコピーを作成(スプレッド構文)
        const cloneArray = [...array];
        // 後ろから順にランダムな場所に入れ替え--fisher-Yates shuffle
        for(let i = cloneArray.length - 1; i > 0; i--){
            const rand = Math.floor(Math.random() * (i + 1));
            [cloneArray[i], cloneArray[rand]] = [cloneArray[rand], cloneArray[i]];
        };
        // 次の処理にcloneArrayを渡す
        return cloneArray;
    }
    const shuffledQuestions = shuffleArray(typingQuestions);

    // 問題をスライス
    const count = Math.min(shuffledQuestions.length, config.questionCounts);
    questionQueue = shuffledQuestions.slice(0, count);

    // カウンターをリセット
    currentQuestionIndex = 0;

    // 最初の問題を表示
    setupQuestionData();
    updateQuestionDisplay();

    // ディスプレイ関連
    startScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    resultsScreen.style.display = 'none';
    
    // 問題欄、回答欄の遅延出現
    const keyframes = [
        {opacity: 0, transform: 'scale(0)'},
        {opacity: 1, transform: 'scale(1)'},
    ];
    const options = {
        duration: 250,
        delay: 500,
        fill: 'forwards',
    };

    for(const screen of delayScreens){
        screen.animate(keyframes, options);
    }
};

// ====================================
// データ処理・ゲーム初期化 (setupQuestionData)
// ====================================

const setupQuestionData = () => {
    const currentQuestion = questionQueue[currentQuestionIndex];
    // 日本語を句読点で分割
    chunkedText = currentQuestion.text.split(/([、。])/).reduce((acc, curr, i, arr) => {
        if(curr.match(/([、。])/) && acc.length > 0){
            acc[acc.length - 1] += curr;
        }else if(curr !== ''){
            acc.push(curr);
        }
        return acc;
    },[]);
    
    // ローマ字をカンマで分割
    chunkedRomaji = currentQuestion.romaji.split(/([,.])/).reduce((acc, curr) => {
        if(curr.match(/([,.])/) && acc.length > 0){
            acc[acc.length - 1] += curr;
        }else if(curr.trim() !== ''){
            acc.push(curr.trim());
        }
        return acc;
    },[]);

    //インデックスのリセット
    currentChunkIndex = 0;
    inputBuffer = "";
    currentTargetRomaji = chunkedRomaji[0];
};

// ====================================
// 画面表示の更新 (updateQuestionDisplay)
// ====================================

const updateQuestionDisplay = () => {

    const currentQuestion = questionQueue[currentQuestionIndex];

    // 文節ごとにspanタグでくくって表示を変化させる
    let htmlContent = '';
    chunkedText.forEach((chunk, index) => {
        let className = '';
        if(index < currentChunkIndex){
            className = 'completed';
        }else if(index === currentChunkIndex){
            className = 'current';
        }
        
        htmlContent += `<span class="${className}">${chunk}</span>`;
    });

    textElement.innerHTML = htmlContent;

    // 分野、出典を表示
    if(currentQuestion){
        fieldElement.textContent = currentQuestion.field;
        sourceElement.textContent = currentQuestion.source;
    }

    // 今打つべき文節を入力欄の上に表示する
    if(chunkedText[currentChunkIndex]){
        guideElement.textContent = chunkedText[currentChunkIndex];
    }else{
        guideElement.textContent = '';
    }

    inputElement.textContent = inputBuffer;

    // 次入力する文字のハイライト
    highlightNextChar();
};

// ====================================
// 次の問題に進む (nextQuestion)
// ====================================

const nextQuestion = () => {
    currentQuestionIndex++;     // 次の問題へ

    // まだ問題があれば表示を更新 なければ終了
    if(currentQuestionIndex < questionQueue.length){
        setupQuestionData();
        updateQuestionDisplay();
    }else{
        finishGame();
    }
};

// ====================================
// ゲーム終了時の処理 (finishGame)
// ====================================

const finishGame = () => {
    isGameActive = false;       // ゲーム終了フラグ
    // 終了タイムスタンプ
    const gameEndTime = Date.now();
    // 経過時間
    const durationSec = (gameEndTime - gameStartTime) / 1000;

    // wpm の計算 
    const wpm = durationSec > 0 ? (correctKeyCount / durationSec).toFixed(2) : 0.00;
    // 正答率の計算
    const totalInputs = correctKeyCount + missedKeyCount;
    const accuracy = totalInputs > 0 ? ((correctKeyCount / totalInputs) * 100).toFixed(1) : 100;

    // 苦手キーの特定
    let weakKeysList = [];
    let maxMisses = 0;
    for (const [key,count] of Object.entries(missedKeysMap)){
        if (count > maxMisses){
            maxMisses = count;
            weakKeysList = [key];
        }else if(count == maxMisses){
            weakKeysList.push(key);
        }
    };
    const weakKeys = weakKeysList.length > 0? weakKeysList.join(',') : '特になし'

    // 保存用データオブジェクト
    const resultData = {
        date: new Date().toISOString(),
        wpm: wpm,
        missCount: missedKeyCount,
        accuracy: accuracy,
        weakKey: weakKeys,
        duration: durationSec,
    };
    
    // データの保存
    saveToLocalStorage(resultData);

    // 画面表示の更新
    document.querySelector('#current-guide').textContent = '';
    document.querySelector('#current-guide').style.display = 'none';
    document.querySelector('#user-input').textContent = 'finish!';
    document.querySelectorAll('.key.active').forEach((keys) => {
        keys.classList.remove('active');
    });

    showResults(resultData);
    console.log('showresultsを実行');
};

// ====================================
// グラフ描画 (drawResultChart)
// ====================================

const drawResultChart = () => {
    const ctx = document.getElementById('result-chart').getContext('2d');

    // ローカルストレージからデータを取得
    const history = getStoredHistory();

    // 直近15回のデータを取得
    const recentHistory = history.slice(-15);

    // データセットの作成
    const labels = recentHistory.map(item => {
        const date = new Date(item.date);

        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hour}:${minute}`
    });
    const wpmData = recentHistory.map((item) => Number(item.wpm));
    const accuracyData = recentHistory.map((item) => Number(item.accuracy));
    
    // チャートの作成
    if(resultChartInstance){
        resultChartInstance.destroy();
    }

    resultChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels : labels,
            datasets: [
                {
                    // wpmデータセット
                    label: '   keys/秒   ',
                    data: wpmData,
                    borderColor: '#2777f7',
                    backgroundColor: 'rgba(39,119,247,0.1)',
                    borderWidth: 2,
                    tension: 0,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#2777f7',
                    fill: true,
                    yAxisID: 'y',
                    order: 1,
                },{
                    // accuracyデータセット
                    label: '   正タイプ率   ',
                    data: accuracyData,
                    borderColor: '#ff9f40',
                    borderWidth: 2,
                    borderDash: [5,5],
                    tension: 0,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#ff9f40',
                    fill: false,
                    yAxisID: 'y1',
                    order: 0,
                    clip: false,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout:{
                padding: {
                    top: 8,
                    bottom: 16,
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    suggestedMax: Math.max(...wpmData, 0) + 1,
                    grid: { color: "#e9f1fd"},
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: { display: false },
                },
                x: {
                    grid: { display: false},
                    ticks: { display: false },
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 10,
                        },
                        boxWidth: 2,
                        padding: 8,
                        generateLabels: (chart) => {
                            const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            items.forEach((item) => {
                                item.lineWidth  = 1;
                            });
                            return items;
                        },
                    }
                },
                tooltip: {
                    displayColors : true,
                    backgroundColor: '#5c5e64',
                    padding: 8,
                    callbacks: {
                        title: (tooltipItems) => {
                            return 'プレイ日時 : ' + tooltipItems[0].label;
                        },
                        label: (context) => {
                            // wpm か accuracy かで表示する単位を変更
                            if(context.dataset.label === 'wpm'){
                                return ' 正タイプ率 : ' + Number(context.raw).toFixed(2) + ' (keys/秒)';
                            } else if(context.dataset.label === '正タイプ率'){
                                return 'タイピング速度 : ' + Number(context.raw).toFixed(1) + ' %';
                            }
                        },
                    }
                }
            },
        },
        // y軸上部に [keys/秒] を表示 
        plugins: [{
            id: 'yAxisUnit',
            afterDraw: (chart) => {

                // 左軸と右軸を取得
                const {ctx, scales: {y, y1}} = chart;
                ctx.save();
                ctx.font = 'normal 12px sans-serif';
                ctx.fillStyle = '#5c5e64';
                ctx.textAlign = 'left';

                // 描画位置
                const yPos = y.top - 16;

                // 左軸 wpm
                ctx.textAlign = 'left';
                ctx.fillText('[keys/秒]', y.left, yPos);

                // 右軸 accuracy
                ctx.textAlign = 'right';
                ctx.fillText('[%]', y1.right, yPos);

                ctx.restore();
            }
        },{
            // 凡例とグラフの間隔を少し広げる
            id: 'legendMargin',
            beforeInit(chart){
                const legend = chart.legend;
                if(!legend || !legend.fit) return;
                const originalFit = legend.fit;
                legend.fit = function fit(){
                    originalFit.call(this);
                    // 凡例の高さを増やすことで下側に余白を追加
                    this.height += 8;
                }
            }
        }]
    })
};

// ====================================
// 結果画面の表示 (showResults)
// ====================================

const showResults = (data) => {
     setTimeout(() => {
        questionArea.animate([
            {height: '13rem', margin: '.5rem .25rem .5rem .25rem', opacity: 1},
            {height: '0rem', margin: '0 .25rem 0 .25rem', opacity: 0},
        ],{
            duration: 400,
            fill: 'forwards',
            transformOrigin: 'top',
        });

        answerArea.animate([
            {height: '8rem'},
            {height: '21rem'},
        ],{
            duration: 400,
            fill: 'forwards',
            transformOrigin: 'bottom',
        });

        keys.forEach((key) => {
            key.animate([
                {opacity: 1, offset: 0},
                {opacity: 0.8, offset: 0.5},
                {opacity: 0, offset: 1}
            ],{
                duration: 400,
                fill: 'forwards',
            });
        });

        inputElement.animate([
            {opacity: 1},
            {opacity: 0},
        ],{
            duration: 200,
            fill: 'forwards',
        });
    }, 1000)
    
    setTimeout(() => {    
        gameScreen.style.display = 'none';
        resultsScreen.style.display = 'flex';
        console.log('リザルト画面を表示');

        // 画面表示の更新
        drawResultChart();
        displayResultStats(data);

        statItems.forEach((item) => {
            item.animate([
                {opacity: 0},
                {opacity: 1},
            ],{
                duration: 500,
                fill: 'forwards',
                easing: 'ease-in-out',
            });
        });
    }, 1500);
};

// ====================================
// ゲームリセット (resetGame)
// ====================================

const resetGame = () => {

    // ゲーム状態変数をリセット
    questionQueue = [];         // 実際に出題される問題のリスト
    currentQuestionIndex = 0;   // 今何問目か
    chunkedText = [];           // 日本語を読点で区切ったリスト
    chunkedRomaji = [];         // ローマ字をカンマで区切ったリスト
    currentChunkIndex = 0;      // 今何個目の文節を打っているか
    currentTargetRomaji = '';   // 今打つべきローマ字の文節
    inputBuffer = '';           // ユーザーが打っている正誤未確定の文節
    gameStartTime = 0;          // 開始タイムスタンプ
    correctKeyCount = 0;        // 正解タイプ数
    missedKeyCount = 0;         // ミスタイプ数
    missedKeysMap = {};         // ミスタイプしたキーを格納するオブジェクト
    isGameActive = false;       // ゲーム進行中フラグ
    if(resultChartInstance){
        resultChartInstance.destroy();
        resultChartInstance = null;    
    }

    // html要素のリセット
    textElement.innerHTML = '';
    inputElement.textContent = '';
    guideElement.textContent = '';
    guideElement.style.display = 'none';
    fieldElement.textContent = '';
    sourceElement.textContent = '';

    // 遅延画面アニメーションのリセット
    delayScreens.forEach((screen) => {
        screen.getAnimations().forEach((animation) => {
            animation.cancel();
        });
        screen.style.opacity = '';
        screen.style.transform = '';
    });

    // ゲーム画面のアニメーションリセット
    questionArea.getAnimations().forEach((animation) => {
        animation.cancel();
    });
    questionArea.style.height = '';
    questionArea.style.margin = '';
    questionArea.style.opacity = '';

    answerArea.getAnimations().forEach((animation) => {
        animation.cancel();
    });
    answerArea.style.height = '';

    keys.forEach((key) => {
        key.getAnimations().forEach((animation) => {
            animation.cancel();
        });
        key.style.opacity = '';
    });

    inputElement.getAnimations().forEach((animation) => {
        animation.cancel();
    });
    inputElement.style.opacity = '';

    // 結果画面の統計アイテムのアニメーションリセット
    statItems.forEach((item) => {
        item.getAnimations().forEach((animation) => {
            animation.cancel();
        });
        item.style.opacity = '';
    });

    // 画面の切り替え
    startScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    resultsScreen.style.display = 'none';
};

// ====================================
// イベントリスナー設定
// ====================================

// --- フォーム提出 → ゲーム開始 ---
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const currentSettings = getGameSettings();
    startGame(currentSettings);
});

// --- キーダウンイベント ---
document.addEventListener('keydown', (event) => {
    
    // Spaceキーの処理
    if(event.code === 'Space'){
        if(startScreen.style.display !== 'none'){
            event.preventDefault();
            btn.click();
        }else if(resultsScreen.style.display !== 'none'){
            event.preventDefault();
            const cfg = lastGameSettings || getGameSettings();
            startGame(cfg);
        }
    }

    // Escキーでゲーム中断
    if(event.code === 'Escape'){
        if (gameScreen.style.display !== 'none'){
        event.preventDefault();
        resetGame();
        }else if(resultsScreen.style.display !== 'none'){
            event.preventDefault();
            resetGame();
        }
    }

    // キー入力の判定処理
    // ゲーム中以外は無視
    if(!isGameActive)return;
    
    // アルファベットor数字のみを受け付ける簡易フィルタ
    if(event.key.length === 1){
        const nextExpectedChar = currentTargetRomaji[inputBuffer.length];
        if(event.key === nextExpectedChar){
            correctKeyCount++;
            inputBuffer += event.key;
             // 分節の入力完了チェック
            if(inputBuffer === currentTargetRomaji){
                currentChunkIndex++;
                inputBuffer = '';
                //すべて打ち終わったか
                if(currentChunkIndex === chunkedRomaji.length){
                    nextQuestion();
                    return;
                }else{
                    currentTargetRomaji = chunkedRomaji[currentChunkIndex];
                }
            }
        }else{
            missedKeyCount++
            // 苦手キーの収集
            if(nextExpectedChar){
                const upperChar = nextExpectedChar.toUpperCase();
                missedKeysMap[upperChar] = (missedKeysMap[upperChar] || 0) + 1;
            }

            highlightMissedKey(event.key);    
        }
        // 画面更新
        updateQuestionDisplay();
    }
});

// --- ヘッダーのリンク処理 ---
const navActions = {
    'nav-home-link': () => {
        startScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        resultsScreen.style.display = 'none';
    },
    'nav-results-link': () => {
        startScreen.style.display = 'none';
        gameScreen.style.display = 'none';
        resultsScreen.style.display = 'flex';
        drawResultChart();
        // 最新履歴で数値表示
        const hist = getStoredHistory();
        const latest = hist.length ? hist[hist.length - 1] : { wpm: 0, accuracy: 0, weakKey: '特になし' };
        displayResultStats(latest);
        statItems.forEach((item) => { item.style.opacity = 1; });
    },
    'nav-setting-link': () => {
        window.location.href = 'setting.html';
    }
}

document.querySelector('.nav').addEventListener('click', (event) => {
    const link = event.target.closest('a[class^="nav-"]');
    if(!link) return;

    event.preventDefault();
    if(isGameActive) return;

    const action = navActions[link.className];
    if(action) action();
});

// const homeLink = document.querySelector('.nav-home-link');
// const resultsLink = document.querySelector('.nav-results-link');
// const settingLink = document.querySelector('.nav-setting-link');


// if(resultsLink){
//     resultsLink.addEventListener('click', (event) => {
//         event.preventDefault();
//         // ゲーム中の場合は処理しない
//         if(isGameActive) return;
        
//         // スタート画面を非表示にして、結果画面を表示
//         startScreen.style.display = 'none';
//         resultsScreen.style.display = 'flex';
        
//         // 結果画面にデータを表示
//         drawResultChart();

//         statItems.forEach((item) => {
//             item.style.opacity = 1;
//         });
//     });
// }

// // --- ホームのリンク処理 ---

// if(homeLink){
//     homeLink.addEventListener('click', (event) => {
//         event.preventDefault();
//         // ゲーム中の場合は処理しない
//         if(isGameActive) return;
        
//         // スタート画面を表示、他の画面を非表示
//         startScreen.style.display = 'block';
//         gameScreen.style.display = 'none';
//         resultsScreen.style.display = 'none';
//     });
// }

// // --- 設定のリンク処理 ---

// if(settingLink){
//     settingLink.addEventListener('click', (event) => {
//         event.preventDefault();
//         // ゲーム中の場合は処理しない
//         if(isGameActive) return;
        
//         // 設定ページへ遷移
//         window.location.href = 'setting.html';
//     });
// }

