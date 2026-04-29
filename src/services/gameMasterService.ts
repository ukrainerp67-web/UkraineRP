import { GoogleGenAI } from "@google/genai";
import { backend } from "./backendService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export class GameMasterService {
  private systemInstruction: string;

  constructor() {
    this.systemInstruction = `
Ти — Ігровий Майстер (Game Master) та автоматизована система управління багатокористувацькою текстовою рольовою грою "Симулятор Верховної Ради". 
Твоє завдання — модерувати гру в спільному чаті. 

[ПРАВИЛА ТА КОМАНДИ]
1. ПРЕЗИДЕНТ: [Вето: Дія], [Звернення до народу], [Догана: Гравець].
2. ПРЕМ'ЄР-МІНІСТР: [Фінансувати сферу: Сума], [Урядове доручення: Гравець].
3. МІНІСТР ФІНАНСІВ: [Встановити податок: Х%], [План зборів: Сума], [Виписати премію/штраф: Гравець].
4. ВФБ: [Аудит: Гравець], [Арешт рахунку: Гравець], [Передати справу до суду].
5. ПОДАТКІВЕЦЬ: [Рейд на бізнес], [Домовитись з бізнесом].

Твоя відповідь має складатися з:
1. Короткого ігрового коментаря на дію гравця (атмосферно, звертаючись за посадою).
2. Якщо була команда — підтвердження виконання (або результат ШІ-генерації, наприклад, звіт Аудиту).
3. Наприкінці виводь СТАТУС-БЛОК:
📊 СТАТУС ДЕРЖАВИ:
Бюджет: [Сума] ₴ | Податок: [Х]%
Рейтинг довіри: [Х]%
Активні конфлікти: [Опис]

Дотримуйся ролі, будь іронічним, але справедливим.
`;
  }

  async processMessage(content: string, profile: any) {
    const message = content.trim();
    const role = profile.role || 'Громадянин';
    const name = `${profile.firstName} ${profile.lastName}`;

    const globalState = await backend.getGlobalState();
    
    // Command parsing
    if (message.includes('[Встановити податок:')) {
      const match = message.match(/\[Встановити податок:\s*(\d+)%?\]/);
      if (match && (role === 'Міністр фінансів' || role === 'admin')) {
         const rate = parseInt(match[1]) / 100;
         await backend.setTaxRate(profile.uid, rate);
      }
    }

    if (message.includes('[Рейд на бізнес]')) {
      if (role === 'Працівник оподаткування' || role === 'admin') {
         await backend.businessRaid(profile.uid);
      }
    }

    if (message.includes('[Аудит:')) {
      if (role === 'Працівник ВФБ' || role === 'admin') {
          // Extra logic needed to find player ID from name in chat, 
          // or we just let Gemini describe the audit if we can't find ID easily.
      }
    }

    // Call Gemini for GM narration
    try {
      const prompt = `ГРАВЕЦЬ: ${name} (Роль: ${role})
ПОВІДОМЛЕННЯ: ${message}

ПОТОЧНИЙ СТАН:
Бюджет: ${globalState.budget} ₴
Податок: ${(globalState.taxRate * 100).toFixed(0)}%
Рейтинг: ${globalState.trustRating}%

Відповідай як Game Master.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: this.systemInstruction,
          temperature: 0.8,
        }
      });

      const gmResponse = response.text || 'Game Master на зв\'язку.';
      
      // Send GM message to chat
      await backend.sendMessage({
        senderId: 'game-master-bot',
        senderName: '🏢 Game Master',
        senderPhoto: 'https://images.unsplash.com/photo-1589149098258-3e9102ca63d3?q=80&w=100&auto=format&fit=crop', // Abstract building/shield icon
        content: gmResponse,
        isBot: true
      });

    } catch (error) {
      console.error("GM Response Error:", error);
    }
  }
}

export const gmService = new GameMasterService();
