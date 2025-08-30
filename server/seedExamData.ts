import { storage } from "./storage";

export async function seedExamData() {
  try {
    console.log("Seeding exam data...");

    // Create demo exam
    const demoExam = await storage.createExam({
      title: "Kiểm tra trình độ tiếng Anh cơ bản (Demo)",
      description: "Đề thi demo giúp bạn làm quen với hệ thống thi trực tuyến. Bao gồm 10 câu hỏi về ngữ pháp và từ vựng tiếng Anh cơ bản.",
      isDemo: true,
      timeLimit: 15, // 15 minutes
      questionCount: 10,
      isActive: true,
      createdBy: "system"
    });

    // Create demo questions
    const demoQuestions = [
      {
        examId: demoExam.id,
        questionText: "Choose the correct form of the verb: She _____ to school every day.",
        options: ["go", "goes", "going", "gone"],
        correctAnswer: "1",
        explanation: "Với chủ ngữ số ít (she), động từ phải chia ở dạng số ít 'goes'."
      },
      {
        examId: demoExam.id,
        questionText: "Which sentence is correct?",
        options: [
          "I am study English",
          "I study English",
          "I studying English",
          "I studies English"
        ],
        correctAnswer: "1",
        explanation: "Câu đúng là 'I study English' - thì hiện tại đơn với chủ ngữ 'I'."
      },
      {
        examId: demoExam.id,
        questionText: "What is the past tense of 'eat'?",
        options: ["eated", "ate", "eaten", "eating"],
        correctAnswer: "1",
        explanation: "'Ate' là dạng quá khứ đơn của động từ 'eat'."
      },
      {
        examId: demoExam.id,
        questionText: "Choose the correct preposition: I'm interested _____ learning Japanese.",
        options: ["on", "at", "in", "for"],
        correctAnswer: "2",
        explanation: "Cụm từ đúng là 'interested in' - có hứng thú với việc gì."
      },
      {
        examId: demoExam.id,
        questionText: "Which word means 'học sinh'?",
        options: ["teacher", "student", "doctor", "engineer"],
        correctAnswer: "1",
        explanation: "'Student' có nghĩa là học sinh, sinh viên."
      },
      {
        examId: demoExam.id,
        questionText: "Complete the sentence: There _____ many books on the table.",
        options: ["is", "are", "was", "been"],
        correctAnswer: "1",
        explanation: "Với danh từ số nhiều 'books', ta dùng 'are'."
      },
      {
        examId: demoExam.id,
        questionText: "What time is it? It's _____ o'clock.",
        options: ["three", "third", "tree", "free"],
        correctAnswer: "0",
        explanation: "'Three' là số đếm, dùng để chỉ giờ."
      },
      {
        examId: demoExam.id,
        questionText: "Choose the correct article: _____ apple a day keeps the doctor away.",
        options: ["A", "An", "The", "No article"],
        correctAnswer: "1",
        explanation: "'An' được dùng trước từ bắt đầu bằng nguyên âm 'a' trong 'apple'."
      },
      {
        examId: demoExam.id,
        questionText: "Which is the correct question form?",
        options: [
          "Where you live?",
          "Where do you live?",
          "Where are you live?",
          "Where you are live?"
        ],
        correctAnswer: "1",
        explanation: "Câu hỏi đúng phải có trợ động từ 'do' với chủ ngữ 'you'."
      },
      {
        examId: demoExam.id,
        questionText: "What does 'beautiful' mean?",
        options: ["xấu", "đẹp", "to", "nhỏ"],
        correctAnswer: "1",
        explanation: "'Beautiful' có nghĩa là đẹp."
      }
    ];

    for (const questionData of demoQuestions) {
      await storage.createQuestion(questionData);
    }

    // Create official exam
    const officialExam = await storage.createExam({
      title: "Kiểm tra năng lực tiếng Anh nâng cao",
      description: "Đề thi chính thức đánh giá năng lực tiếng Anh nâng cao. Gồm 20 câu hỏi về ngữ pháp, từ vựng và đọc hiểu. Cần đăng nhập để tham gia.",
      isDemo: false,
      timeLimit: 30, // 30 minutes
      questionCount: 20,
      isActive: true,
      createdBy: "system"
    });

    // Create official exam questions
    const officialQuestions = [
      {
        examId: officialExam.id,
        questionText: "Choose the most appropriate word to complete the sentence: The scientist's discovery was _____ groundbreaking.",
        options: ["extremely", "extreme", "extremes", "extremity"],
        correctAnswer: "0",
        explanation: "'Extremely' là trạng từ, bổ nghĩa cho tính từ 'groundbreaking'."
      },
      {
        examId: officialExam.id,
        questionText: "Which sentence demonstrates correct use of the subjunctive mood?",
        options: [
          "If I was rich, I would travel the world",
          "If I were rich, I would travel the world",
          "If I am rich, I would travel the world",
          "If I will be rich, I would travel the world"
        ],
        correctAnswer: "1",
        explanation: "Trong câu điều kiện không có thực, ta dùng 'were' với tất cả các ngôi."
      },
      {
        examId: officialExam.id,
        questionText: "Select the sentence with correct parallel structure:",
        options: [
          "She likes dancing, singing, and to paint",
          "She likes dancing, singing, and painting",
          "She likes to dance, singing, and painting",
          "She likes dancing, to sing, and painting"
        ],
        correctAnswer: "1",
        explanation: "Cấu trúc song song yêu cầu các động từ cùng dạng: dancing, singing, painting."
      },
      {
        examId: officialExam.id,
        questionText: "What is the meaning of the idiom 'break the ice'?",
        options: [
          "To literally break frozen water",
          "To start a conversation in a social situation",
          "To solve a difficult problem",
          "To end a relationship"
        ],
        correctAnswer: "1",
        explanation: "'Break the ice' có nghĩa là phá vỡ sự ngại ngùng, bắt đầu trò chuyện."
      },
      {
        examId: officialExam.id,
        questionText: "Choose the correct form: The data _____ conclusive evidence of climate change.",
        options: ["shows", "show", "showing", "shown"],
        correctAnswer: "1",
        explanation: "'Data' là danh từ số nhiều, nên động từ phải chia ở dạng 'show'."
      }
    ];

    // Add more questions to reach 20
    for (let i = 6; i <= 20; i++) {
      officialQuestions.push({
        examId: officialExam.id,
        questionText: `Advanced English Question ${i}: Which option best completes this sentence?`,
        options: [
          `Option A for question ${i}`,
          `Option B for question ${i}`,
          `Option C for question ${i}`,
          `Option D for question ${i}`
        ],
        correctAnswer: Math.floor(Math.random() * 4).toString(),
        explanation: `This is the explanation for question ${i}.`
      });
    }

    for (const questionData of officialQuestions) {
      await storage.createQuestion(questionData);
    }

    // Create Japanese exam
    const japaneseExam = await storage.createExam({
      title: "Kiểm tra trình độ tiếng Nhật N5",
      description: "Đề thi kiểm tra trình độ tiếng Nhật tương đương N5. Bao gồm các câu hỏi về Hiragana, Katakana, từ vựng và ngữ pháp cơ bản.",
      isDemo: false,
      timeLimit: 25,
      questionCount: 15,
      isActive: true,
      createdBy: "system"
    });

    const japaneseQuestions = [
      {
        examId: japaneseExam.id,
        questionText: "あなたの なまえは なんですか？",
        options: ["Bạn tên gì?", "Bạn bao nhiêu tuổi?", "Bạn ở đâu?", "Bạn làm gì?"],
        correctAnswer: "0",
        explanation: "あなたの なまえは なんですか có nghĩa là 'Bạn tên gì?'"
      },
      {
        examId: japaneseExam.id,
        questionText: "Choose the correct Hiragana for 'arigatou':",
        options: ["ありがとう", "こんにちは", "さようなら", "おはよう"],
        correctAnswer: "0",
        explanation: "ありがとう là cách viết Hiragana của 'arigatou' (cảm ơn)."
      }
    ];

    // Add more Japanese questions
    for (let i = 3; i <= 15; i++) {
      japaneseQuestions.push({
        examId: japaneseExam.id,
        questionText: `Japanese N5 Question ${i}`,
        options: [
          `Japanese option A ${i}`,
          `Japanese option B ${i}`,
          `Japanese option C ${i}`,
          `Japanese option D ${i}`
        ],
        correctAnswer: Math.floor(Math.random() * 4).toString(),
        explanation: `Explanation for Japanese question ${i}.`
      });
    }

    for (const questionData of japaneseQuestions) {
      await storage.createQuestion(questionData);
    }

    console.log("✓ Seeded exam data successfully");
    console.log(`✓ Created ${await storage.getAllExams().then(exams => exams.length)} exams`);
    
  } catch (error) {
    console.error("Error seeding exam data:", error);
  }
}