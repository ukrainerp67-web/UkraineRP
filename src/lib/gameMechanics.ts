import prisma from './prisma';
import bcrypt from 'bcrypt';

/**
 * 1. Система реєстрації
 * Створює гравця, перевіряючи унікальність username та email.
 */
export async function registerPlayer(username: string, email: string, passwordPlain: string) {
  // Перевірка на існуючого гравця
  const existingPlayer = await prisma.player.findFirst({
    where: {
      OR: [{ username }, { email }]
    }
  });

  if (existingPlayer) {
    throw new Error('Username або email вже зайняті');
  }

  // Хешування пароля (10 раундів — стандарт для безпеки)
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  return await prisma.player.create({
    data: {
      username,
      email,
      passwordHash,
      balance: 1000.0, // Початковий капітал
    }
  });
}

/**
 * 2. Система економіки
 * Безпечне додавання або віднімання коштів.
 */
export async function updateBalance(playerId: string, amount: number) {
  // Використовуємо транзакцію для безпеки, якщо потрібно більше дій, 
  // але для простого оновлення Prisma вистачить атомарного update
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  
  if (!player) throw new Error('Гравця не знайдено');
  
  if (player.balance + amount < 0) {
    throw new Error('Недостатньо коштів на балансі');
  }

  return await prisma.player.update({
    where: { id: playerId },
    data: {
      balance: {
        increment: amount
      }
    }
  });
}

/**
 * 3. Система інвентарю
 * Додає предмет: якщо він є — збільшує кількість, якщо ні — створює запис.
 */
export async function addItemToInventory(playerId: string, itemId: string, quantity: number = 1) {
  return await prisma.inventoryItem.upsert({
    where: {
      playerId_itemId: { playerId, itemId }
    },
    update: {
      quantity: {
        increment: quantity
      }
    },
    create: {
      playerId,
      itemId,
      quantity
    }
  });
}

/**
 * 4. Система досягнень
 * Оновлення прогресу та автоматичне завершення.
 */
export async function updateAchievementProgress(playerId: string, achievementId: string, progressDelta: number) {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) throw new Error('Досягнення не існує');

  // Отримуємо або створюємо запис про прогрес гравця
  const playerAchievement = await prisma.playerAchievement.upsert({
    where: {
      playerId_achievementId: { playerId, achievementId }
    },
    update: {
      progress: {
        increment: progressDelta
      }
    },
    create: {
      playerId,
      achievementId,
      progress: progressDelta
    }
  });

  // Перевірка умови виконання (наприклад, ціль 100 одиниць чогось)
  // Тут можна додати поле 'goal' в модель Achievement для гнучкості
  const GOAL = 10; // Наприклад, ціль досягнення
  
  if (playerAchievement.progress + progressDelta >= GOAL && !playerAchievement.isCompleted) {
    return await prisma.playerAchievement.update({
      where: { id: playerAchievement.id },
      data: {
        isCompleted: true,
        completedAt: new Date()
      }
    });
  }

  return playerAchievement;
}

/**
 * 5. Система досвіду та рівнів (XP)
 * Автоматичне підвищення рівня.
 */
export async function addXp(playerId: string, xpPoints: number) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw new Error('Гравця не знайдено');

  let newXp = player.xp + xpPoints;
  let newLevel = player.level;

  // Формула рівня: кожен наступний рівень потребує Level * 100 XP
  while (newXp >= newLevel * 100) {
    newXp -= newLevel * 100;
    newLevel++;
  }

  return await prisma.player.update({
    where: { id: playerId },
    data: {
      xp: newXp,
      level: newLevel
    }
  });
}
