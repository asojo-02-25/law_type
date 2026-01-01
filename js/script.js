// --- ゲーム関連処理 ---
// --- 変数 / 定数の定義 ---
let questionQueue = [];         // 実際に出題される問題のリスト
let currentQuestionIndex = 0;   // 今何問目か
let chunkedText = [];           // 日本語を読点で区切ったリスト
let chunkedRomaji = [];         // ローマ字をカンマで区切ったリスト
let currentChunkIndex = 0;       // 今何個目の文節を打っているか
let currentTargetRomaji = '';   // 今打つべきローマ字の文節
let inputBuffer = '';           // ユーザーが打っている正誤未確定の文節
let gameStartTime = 0;          // 開始タイムスタンプ
let correctKeyCount = 0;        // 正解タイプ数
let missedKeyCount = 0;           // ミスタイプ数
let missedKeysMap = {};         // ミスタイプしたキーを格納する配列

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

// --- html要素の取得 ---
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

// --- 問題を格納する配列のインポート ---
import {typingQuestions} from './question.js';

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

// --- データのセットアップ ---
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

// --- タイプべきキーのハイライト ---
const highlightNextChar = () => {
    
    if(!currentTargetRomaji) return;
    
    // すでにactiveなキーのリセット
    const activeKeys = document.querySelectorAll('.key.active');
    activeKeys.forEach((keys) => {
        keys.classList.remove('active');
    });

    // --- html要素の取得 ---
    const nextChar = currentTargetRomaji[inputBuffer.length];
    if(!nextChar) return;
    
    // --- Id の取得 / ターゲット文字のハイライト --- 
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
            {backgroundColor: 'black', offset: 1},
        ];
        const options = {
            duration: 200,
            iterations: 2,
            easing: 'ease-out',
        }
        targetElement.animate(keyframes, options);
    }
};

// --- 画面表示の更新 ---
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

// --- ゲーム終了時の処理 ---
const finishGame = () => {
    // 終了タイムスタンプ
    const gameEndTime = Date.now();
    // 経過時間
    const durationSec = (gameEndTime - gameStartTime) / 1000;

    // wpm の計算 (5文字 / 単語)
    const wpm = durationSec > 0 ? Math.round((correctKeyCount / (durationSec * 5)) * 60) : 0;
    // 正答率の計算
    const totalInputs = correctKeyCount + missedKeyCount;
    const accuracy = totalInputs > 0 ? (correctKeyCount / totalInputs).toFixed(1) : 100;

    // 苦手キーの特定
    let weakKeys = '特になし';
    let maxMisses = 0;
    for (const [key,count] of Object.entries(missedKeysMap)){
        if (count > maxMisses){
            maxMisses = count;
            weakKeys = key;
        }
    };
    // 保存用データオブジェクト
    const resultData = {
        date: new Date().toISOString,
        wpm: wpm,
        missCount: missedKeyCount,
        accuracy: accuracy,
        weakKey: weakKeys,
        duration: durationSec,
    };
    
    // データの保存
    saveToLocalStrage(resultData);

    // 画面表示の更新
    document.querySelector('#current-guide').textContent = '';
    document.querySelector('#current-guide').style.display = 'none';
    document.querySelector('#user-input').textContent = 'finish!';
    document.querySelectorAll('.key.active').forEach((keys) => {
        keys.classList.remove('active');
    });

    showResults(resultData);
};

// --- localStrageへの保存 ---
const saveToLocalStrage = (data) => {
    const STORAGE_KEY = 'law_type_play_data';
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    }catch(e){
        console.error('storage parse error', e);
    }
    history.push(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

// リザルト画面の表示
const showResults = (data) => {

    gameScreen.style.display = 'none';
    resultsScreen.style.display = 'block';
    
    // リトライボタンの設定
};

// --- 次の問題に進む準備 ---
const nextQuestion = () => {
    currentQuestionIndex++;     // 次の問題へ

    // まだ問題があれば表示を更新 なければ終了
    if(currentQuestionIndex < questionQueue.length){
        setupQuestionData();
        updateQuestionDisplay();
    }else{
        finishGame();
    }
    // 結果画面への遷移などを後で記述
};

// --- ゲームスタート時の処理 ---
const startGame = (config) => {
    guideElement.style.display = 'block';
    
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

// --- 1.10. フォーム提出 → ゲーム開始の実行処理 ---
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const currentSettings = getGameSettings();
    startGame(currentSettings);
});

// --- 1.11. Escキーによりゲームを中断
const resetGame = () => {
    //画面の切り替え
    startScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    resultsScreen.style.display = 'none';

    //アニメーションのリセット
    for(const screen of delayScreens){
        //スタイルの不透明度とサイズを復元
        screen.style.opacity = '0';
        screen.style.transform = 'scale(0)';
        //アニメーションの解除
        screen.getAnimations().forEach((animation) => {
            animation.cancel();
        });
    }
};

// --- 1.12. ゲーム進行中のキーダウンイベント ---
document.addEventListener('keydown', (event) => {
    
    if(event.code === 'Space'){
        if(startScreen.style.display !== 'none'){
            console.log("spaceが押下されました")
            event.preventDefault();
            btn.click();
        }else if(resultsScreen.style.display !== 'none'){
            event.preventDefault();
            // restartButton.click();
        }
    }

    if(event.code === 'Escape' && gameScreen !== 'none'){
        event.preventDefault();
        resetGame();
    }

    //キー入力の判定処理
    // ゲーム中以外は無視
    if(gameScreen.style.display === 'none')return;
    if(!currentTargetRomaji && currentQuestionIndex >= questionQueue.length)return;
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









