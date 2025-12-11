// --- 1. 設定画面 → ゲーム画面の切り替え&ゲーム開始の処理 ---
// --- 1.1. html要素の取得 ---
const form = document.querySelector('#form');
const startScreen = document.querySelector('#start-screen');
const gameScreen = document.querySelector('#game-screen');
const resultsScreen = document.querySelector('#results-screen');
const delayScreens = document.querySelectorAll('.delay-screen');
const btn = document.querySelector('#start-button');

// --- 1.2. 設定の取得 ---
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

// --- 1.3. startGame関数の定義 ---
// --- 1.3.1. 変数の定義 ---
let questionQueue = [];         // 実際に出題される問題のリスト
let currentQuestionIndex = 0;   // 今何問目か
let chunkedText = [];           // 日本語を読点で区切ったリスト
let chunkedRomaji = [];         // ローマ字をカンマで区切ったリスト
let currentChunkIndex = 0;       // 今何個目の文節を打っているか
let currentTargetRomaji = '';   // 今打つべきローマ字の文節
let inputBuffer = '';           // ユーザーが打っている正誤未確定の文節

// --- 1.3.2. 問題を格納する配列 ---
const typingQuestions = [
    {
        text: '憲法二二条一項は、日本国内における居住・移転の自由を保障する旨を規定するにとどまり、外国人がわが国に入国することについてはなんら規定していないものである',
        romaji: 'kenpounijuunijouikkouha,nipponnkokunainiokerukyojuu/itennnojiyuuwohoshousurumunewokiteisurunitodomari,gaikokujinngawagakunininyuukokusurukotonituitehanannrakiteisiteinaimonodearu.',
        field: '憲法',
        source: 'マクリーン事件',
    },
    {
        text: '国際慣習法上、国家は外国人を受け入れる義務を負うものではなく、特別の条約がない限り、外国人を自国内に受け入れるかどうか、また、これを受け入れる場合にいかなる条件を付するかを、当該国家が自由に決定することができるものとされている。',
        romaji: 'kokusaikannshuuhoujou,kokkahagaikokujinnwoukeirerugimuwooumonodehanaku,tokubetunojouyakuganaikagiri,gaikokujinnwojikokunainiukeirerukadouka,mata,korewoukeirerubaainiikanarujoukenwohusurukawo,tougaikokkagajiyuuniketteisurukotogadekirumonotosareteiru.',
        field: '憲法',
        source: 'マクリーン事件',
    },
];

// --- 1.3.3 データのセットアップ ---
const setupQuestionData = () => {
    const currentQuestion = questionQueue[currentQuestionIndex];
    // 日本語を句読点で分割
    chunkedText = currentQuestion.text.split(/([、。])/).reduce((acc, curr, i, arr) => {
        if(curr.match(/[、。]/) && acc.length > 0){
            acc[acc.length - 1] += curr;
        }else if(curr !== ''){
            acc.push(curr);
        }
        return acc;
    },[]);
    
    // ローマ字をカンマで分割
    chunkedRomaji = currentQuestion.romaji.split(/[,.]/).reduce((acc, curr) => {
        if(curr.match(/[,.]/) && acc.length > 0){
            acc[acc.length - 1] += curr;
        }else if(curr.trim() !== ''){
            acc.push(curr);
        }
        return acc;    
    },[]);

    //インデックスのリセット
    currentChunkIndex = 0;
    inputBuffer = "";
    currentTargetRomaji = chunkedRomaji[0];
};

// --- 1.3.4. 画面表示の更新 ---
const updateQuestionDisplay = () => {

    // html要素を取得
    const textElement = document.querySelector('#question-text');
    const romajiElement = document.querySelector('#question-romaji')
    const inputElement = document.querySelector('#user-input');

    //文節ごとにspanタグでくくって表示を変化させる
    let htmlContent = '';

    chunkedText.forEach((chunk, index) => {
        let className = '';
        if(index < currentChunkIndex){
            className = 'completed';
        }else if(index = currentChunkIndex){
            className = 'current';
        }
        
        htmlContent += `<span class="${className}">${chunk}</span>`;
    });

    textElement.innerHTML = htmlContent;

    inputElement.textContent = inputBuffer;
};

// --- 1.3.5. 次の問題に進む準備 ---
const nextQuestion = () => {
    currentQuestionIndex++;     // 次の問題へ

    // まだ問題があれば表示を更新 なければ終了
    if(currentQuestionIndex < questionQueue.length){
        setupQuestionData();
        updateQuestionDisplay();
    }else{
        inputElement.textContent = 'finish!'
        // 結果画面への遷移などを後で記述
    }
};

// --- 1.3.6. startGame関数 ---
const startGame = (config) => {
    // 設定の取得・反映
    console.log("開始設定", config);

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
    // startScreenの非表示
    startScreen.style.display = 'none';
    // gameScreenの表示
    gameScreen.style.display = 'block';
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

// --- 1.4. フォーム提出 → ゲーム開始の実行処理 ---
form.addEventListener('submit', (event) => {
    console.log("フォームが提出されました");
    event.preventDefault();
    const currentSettings = getGameSettings();
    startGame(currentSettings);
});

// --- 1.5. Spaceキー押下時にもフォーム提出と同様の処理を行う ---
document.addEventListener('keydown', (event) => {
    if(event.code === 'Space' && startScreen.style.display !== 'none'){
        event.preventDefault();
        btn.click();
    }
});

// --- 2. ゲーム中にEscキーによりゲームを中断する場合の処理 ---
// --- 2.1. resetGame関数の用意 ---
const resetGame = () => {
    //画面の切り替え
    gameScreen.style.display = 'none';
    startScreen.style.display = 'block';
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
    // 将来的にゲームのタイマー等をリセットする処理を記述する必要有
};
// --- 2.2. Escキー押下時にゲーム中断 ---
document.addEventListener('keydown', (event) => {
    if(event.code === 'Escape' && gameScreen !== 'none'){
        event.preventDefault();
        resetGame();
    }
});

// --- 3. ゲーム中の処理 ---






