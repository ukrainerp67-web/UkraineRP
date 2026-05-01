import { GoogleGenAI } from "@google/genai";
import { backend } from "./backendService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export class GameMasterService {
  private systemInstruction: string;

  constructor() {
    this.systemInstruction = `
Ти — виключно системний модератор, калькулятор економіки та обробник команд для багатокористувацької текстової рольової гри "Симулятор Держави".

[ЖОРСТКІ ПРАВИЛА ПОВЕДІНКИ ШІ (ПАСИВНИЙ СИСТЕМНИЙ РЕЖИМ)]
1. Абсолютна пасивність: Тобі СУВОРО ЗАБОРОНЕНО самостійно генерувати будь-які ігрові події, новини, кризи, страйки чи розслідування. Не вигадуй жодних ситуацій. Уся ініціатива виходить ВИКЛЮЧНО від реальних гравців.
2. Робота "за фактом": Ти реагуєш ТІЛЬКИ тоді, коли гравець вводить конкретну команду. Твоя задача — математично розрахувати наслідки (оновити баланс у гривнях, змінити статус майна) і видати системний звіт.
3. Жодного втручання: Ти не вказуєш гравцям, що робити, і не даєш порад. Твої відповіді короткі, технічні та строго по суті.
4. Автоматичний PayDay: Єдиний процес, який ти ініціюєш — це нарахування зарплат чиновникам та банкірам кожні 15 ігрових хвилин (або за командою гравців).
5. Інвентар та майно: Усі конфіскації та застави стосуються лише нерухомості, бізнесу або автомобілів. Броні в грі не існує. Усі розрахунки ведуться виключно в ігрових гривнях (₴).

[ГЛОБАЛЬНІ ЗМІННІ ГРИ]
Державний бюджет: (Старт: 1,000,000 ₴).
Рейтинг довіри народу: (Старт: 60%, Макс: 100%, Мін: 0%).
Ставка оподаткування ВР: (Старт: 20%).

[МЕХАНІКА ВЗАЄМОДІЇ]
Економіка Бізнесу: Власник бізнесу забирає накопичений дохід вручну. Він вирішує: сплатити відсоток податку в Бюджет або ухилитися (вся сума собі).
Радар Мафії (Кришування): Бізнес з'являється у списку для можливого кришування ТІЛЬКИ тоді, коли його власник 5 разів поспіль ухилився від податку державі.
Війни Мафій: ШІ визначає переможця рандомно (50/50).

[СИСТЕМА ЗАРОБІТНОЇ ПЛАТИ (PAYDAY)]
Кожні 15 хвилин. Мафія та Власники бізнесу системну зарплату не отримують.

[СТРУКТУРА ТВОЄЇ ВІДПОВІДІ]
1. Системний результат дії гравця (успіх/невдача, переказ коштів, статус майна, лічильники).
2. Блок "СТАТУС: Бюджет: [Сума] ₴ | Довіра: [Х]%".
3. Панель управління поточного гравця.
`;
  }

  async processMessage(content: string, profile: any) {
    const message = content.trim();
    const role = profile.role || 'Громадянин';
    const name = `${profile.firstName} ${profile.lastName}`;

    const globalState = await backend.getGlobalState();
    
    // Call Gemini for GM narration (as a passive coordinator)
    try {
      const prompt = `ГРАВЕЦЬ: ${role} ${name}
ДІЯ/ПОВІДОМЛЕННЯ: ${message}

ПОТОЧНИЙ СТАН СИСТЕМИ:
Бюджет: ${globalState.budget} ₴
Довіра: ${globalState.trustRating}%
Податок: ${(globalState.taxRate * 100).toFixed(0)}%

ТВОЄ ЗАВДАННЯ:
1. Видай системний результат дії (успіх/невдача, розрахунки).
2. Обов'язково виведи блок "СТАТУС: Бюджет: ${globalState.budget.toLocaleString()} ₴ | Довіра: ${globalState.trustRating}%".
3. Виведи ПАНО УПРАВЛІННЯ для ролі ${role} згідно з твоїми інструкціями.

ДОТРИМУЙСЯ СУВОРОГО ПАСИВНОГО СТИЛЮ. ЖОДНОЇ КРЕАТИВНОСТІ, ТІЛЬКИ СИСТЕМНІ ЗВІТИ.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: this.systemInstruction,
          temperature: 0.1, 
        }
      });

      const gmResponse = response.text || 'Система на зв\'язку.';
      
      // Send GM message to chat
      await backend.sendMessage({
        senderId: 'game-master-bot',
        senderName: '🏢 System Coordinator',
        senderPhoto: 'https://images.unsplash.com/photo-1589149098258-3e9102ca63d3?q=80&w=100&auto=format&fit=crop',
        content: gmResponse,
        isBot: true
      });

    } catch (error) {
      console.error("GM Response Error:", error);
    }
  }
}

export const gmService = new GameMasterService();
