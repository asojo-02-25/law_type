//設定画面→ゲーム画面の切り替え&ゲーム開始の処理

const form = document.querySelector('#form')
const startScreen = document.querySelector('#start-screen')
const gameScreen = document.querySelector('#game-screen')
const resultsScreen = document.querySelector('#results-screen')
const delayScreens = document.querySelectorAll('.delay-screen')
const btn = document.querySelector('#start-button')

//設定の取得
const getGameSettings = () => {
    //問題形式
    const format = document.querySelector('input[name="format"]:checked').value;
    //問題数
    const itemcounts = parseInt(document.querySelector('input[name="itemcounts"]:checked').value);
    //各種設定
    const options = []
    document.querySelectorAll('input[name="setting"]:checked').forEach((checkbox) => {
        options.push(checkbox.value);
    });

    return{
        mode: format,
        questionCounts: itemcounts,
        settings: options,
    }
};

//フォーム提出時→ゲーム開始のイベントリスナー
form.addEventListener('submit', (event) => {
    console.log("フォームが提出されました");
    event.preventDefault();
    const currentSettings = getGameSettings()
    startGame(currentSettings);
});

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
}

//Space,Escキー押下時の処理
document.addEventListener('keydown', (event) => {
    //スペースキー押下時もフォーム提出と同様の処理を行う
    if(event.code === 'Space' && startScreen.style.display !== 'none'){
        event.preventDefault();
        btn.click();
    }
    //Escキー押下時にゲーム中断
    if(event.code === 'Escape' && gameScreen !== 'none'){
        event.preventDefault();
        resetGame();
    }
});

//ゲーム開始の処理
const startGame = (config) => {
    console.log("開始設定", config)

    if(config.settings.includes('roman-letters-represent')){
        console.log("ローマ字を表示します");
    }
    if(config.settings.includes('keyboard-represent')){
        console.log("キーボードを表示します");
    }



    //ディスプレイ関連
    //startScreenの非表示
    startScreen.style.display = 'none';
    //gameScreenの表示
    gameScreen.style.display = 'block';
    //問題欄、回答欄の遅延出現
    const keyframes = [
        {opacity: 0, transform: 'scale(0)'},
        {opacity: 1, transform: 'scale(1)'},
    ];
    const options = {
        duration: 250,
        delay: 500,
        fill: 'forwards',
    }

    for(const screen of delayScreens){
        screen.animate(keyframes, options);
    }
};

// startGame関数の準備関数
let questionQueue = []          //実際に出題される問題のリスト
let currentQuestionIndex = 0     //今何問目か
let currentCharIndex = 0        // 何文字目をタイプしているか

//html要素を取得
const textElement = document.querySelector('#question-text')
const inputElement = document.querySelector('#user-input')

//画面に問題を表示する関数
const updateQuestionDisplay = () => {

    //今の問題データを取得
    const currentQuestion = questionQueue[currentQuestonIndex]

    //html要素をもとに画面にセット
    textElement.textcontent = currentQuestion.text;

    //ユーザー入力欄を空に
    inputElement.textcontent = '';
};

//次の問題に進む準備
const nextQuestion = () => {
    currentQuestionIndex++;     // 次の問題へ
    currentCharIndex = 0;       // 文字数はリセット

    // まだ問題があれば表示を更新 なければ終了
    if(currentquestionIndex < questionQueue.length){
        updateQuestionDisplay();
    }else{
        inputElement.textcontent = 'finish!'
        // 結果画面への遷移などを後で記述
    }
        
};

// 問題をシャッフルする関数
const shuffleArray = (array) => {
    //もとの配列が壊れないようにコピーを作成(スプレッド構文)
    const cloneArray = [...array]
    //後ろから順にランダムな場所に入れ替え



}

//問題を格納する配列 - これ以下は何も記述したくない
const typingQuestions = [
    {
        text: '憲法二二条一項は、日本国内における居住・移転の自由を保障する旨を規定するにとどまり、外国人がわが国に入国することについてはなんら規定していないものである',
        field: '憲法',
        source: 'マクリーン事件',
    },
    {
        text: '国際慣習法上、国家は外国人を受け入れる義務を負うものではなく、特別の条約がない限り、外国人を自国内に受け入れるかどうか、また、これを受け入れる場合にいかなる条件を付するかを、当該国家が自由に決定することができるものとされている。',
        field: '憲法',
        source: 'マクリーン事件',
    },
]






