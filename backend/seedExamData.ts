import { storage } from "./storage";

export async function seedExamData() {
  try {
    console.log("Seeding exam data...");

    // Check if there are already exams in the database
    const existingExams = await storage.getAllExams();
    if (existingExams.length > 0) {
      console.log(`✓ Found ${existingExams.length} existing exams, checking for missing questions...`);
      await seedMissingQuestions();
      return;
    }

    // First create independent questions for the question bank
    const vocabularyQuestions = await createVocabularyQuestions();
    const grammarQuestions = await createGrammarQuestions();
    const listeningQuestions = await createListeningQuestions();
    const readingQuestions = await createReadingQuestions();

    // Create demo exam with 4-section structure
    const demoExam = await storage.createExam({
      title: "Kiểm tra trình độ tiếng Anh cơ bản (Demo)",
      description: "Đề thi demo với 4 phần: Từ vựng (10 phút), Ngữ pháp (10 phút), Nghe hiểu (5 phút), Đọc hiểu (5 phút). Tổng thời gian 30 phút.",
      isDemo: true,
      vocabularyTimeLimit: 10,
      vocabularyQuestions: vocabularyQuestions.slice(0, 10).map(q => q.id), // 10 vocabulary questions
      grammarTimeLimit: 10,
      grammarQuestions: grammarQuestions.slice(0, 10).map(q => q.id), // 10 grammar questions  
      listeningTimeLimit: 5,
      listeningQuestions: listeningQuestions.slice(0, 5).map(q => q.id), // 5 listening questions
      readingTimeLimit: 5,
      readingQuestions: readingQuestions.slice(0, 5).map(q => q.id), // 5 reading questions
      isActive: true,
      createdBy: "system"
    });

    // Create official exam
    const officialExam = await storage.createExam({
      title: "Kiểm tra trình độ tiếng Anh chính thức",
      description: "Đề thi chính thức với 4 phần: Từ vựng (15 phút), Ngữ pháp (20 phút), Nghe hiểu (15 phút), Đọc hiểu (20 phút). Tổng thời gian 70 phút.",
      isDemo: false,
      vocabularyTimeLimit: 15,
      vocabularyQuestions: vocabularyQuestions.map(q => q.id), // All vocabulary questions
      grammarTimeLimit: 20,
      grammarQuestions: grammarQuestions.map(q => q.id), // All grammar questions
      listeningTimeLimit: 15,
      listeningQuestions: listeningQuestions.map(q => q.id), // All listening questions
      readingTimeLimit: 20,
      readingQuestions: readingQuestions.map(q => q.id), // All reading questions
      isActive: true,
      createdBy: "system"
    });

    console.log(`✓ Created demo exam: ${demoExam.title}`);
    console.log(`✓ Created official exam: ${officialExam.title}`);
  } catch (error) {
    console.error("Error seeding exam data:", error);
  }
}

async function createVocabularyQuestions() {
  const questions = [
    {
      category: "từ vựng",
      language: "english",
      description: "Chọn từ có nghĩa đúng",
      questionText: "Which word means 'học sinh'?",
      options: ["teacher", "student", "doctor", "engineer"],
      correctAnswer: "1",
      explanation: "'Student' có nghĩa là học sinh, sinh viên."
    },
    {
      category: "từ vựng", 
      language: "english",
      description: "Chọn từ đồng nghĩa",
      questionText: "Choose the synonym of 'happy':",
      options: ["sad", "joyful", "angry", "tired"],
      correctAnswer: "1",
      explanation: "'Joyful' là từ đồng nghĩa với 'happy', cùng có nghĩa là vui vẻ."
    },
    {
      category: "từ vựng",
      language: "english", 
      description: "Chọn từ trái nghĩa",
      questionText: "What is the opposite of 'big'?",
      options: ["large", "huge", "small", "enormous"],
      correctAnswer: "2",
      explanation: "'Small' là từ trái nghĩa với 'big'."
    },
    {
      category: "từ vựng",
      language: "english",
      description: "Nghĩa của từ trong ngữ cảnh",
      questionText: "In the sentence 'The weather is pleasant today', what does 'pleasant' mean?",
      options: ["bad", "terrible", "nice", "cold"],
      correctAnswer: "2", 
      explanation: "'Pleasant' có nghĩa là dễ chịu, tốt đẹp."
    }
  ];

  const createdQuestions = [];
  for (const q of questions) {
    const question = await storage.createQuestion(q);
    createdQuestions.push(question);
  }
  return createdQuestions;
}

async function createGrammarQuestions() {
  const questions = [
    {
      category: "ngữ pháp",
      language: "english",
      description: "Chia động từ",
      questionText: "Choose the correct form of the verb: She _____ to school every day.",
      options: ["go", "goes", "going", "gone"],
      correctAnswer: "1",
      explanation: "Với chủ ngữ số ít (she), động từ phải chia ở dạng số ít 'goes'."
    },
    {
      category: "ngữ pháp",
      language: "english", 
      description: "Thì hiện tại đơn",
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
      category: "ngữ pháp",
      language: "english",
      description: "Quá khứ đơn",
      questionText: "What is the past tense of 'eat'?",
      options: ["eated", "ate", "eaten", "eating"],
      correctAnswer: "1",
      explanation: "'Ate' là dạng quá khứ đơn của động từ 'eat'."
    },
    {
      category: "ngữ pháp",
      language: "english",
      description: "Giới từ",
      questionText: "Choose the correct preposition: I'm interested _____ learning Japanese.",
      options: ["on", "at", "in", "for"],
      correctAnswer: "2",
      explanation: "Cụm từ đúng là 'interested in' - có hứng thú với việc gì."
    }
  ];

  const createdQuestions = [];
  for (const q of questions) {
    const question = await storage.createQuestion(q);
    createdQuestions.push(question);
  }
  return createdQuestions;
}

async function createListeningQuestions() {
  const questions = [
    {
      category: "nghe hiểu",
      language: "english",
      description: "Nghe và chọn đáp án đúng",
      questionText: "Listen and choose the correct answer: What time does the store open?",
      options: ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM"],
      correctAnswer: "1",
      explanation: "Cửa hàng mở cửa lúc 9:00 AM theo như audio."
    },
    {
      category: "nghe hiểu",
      language: "english",
      description: "Nghe hội thoại",
      questionText: "In the conversation, where are the speakers going?",
      options: ["To the park", "To the library", "To the restaurant", "To the cinema"],
      correctAnswer: "2", 
      explanation: "Trong hội thoại, họ nói về việc đi thư viện."
    }
  ];

  const createdQuestions = [];
  for (const q of questions) {
    const question = await storage.createQuestion(q);
    createdQuestions.push(question);
  }
  return createdQuestions;
}

async function createReadingQuestions() {
  const questions = [
    {
      category: "đọc hiểu",
      language: "english", 
      description: "Đọc đoạn văn và trả lời câu hỏi",
      questionText: "Read the passage: 'Tom is a student at ABC University. He studies computer science and enjoys programming.' What does Tom study?",
      options: ["Mathematics", "Computer Science", "Literature", "History"],
      correctAnswer: "1",
      explanation: "Theo đoạn văn, Tom học ngành khoa học máy tính (Computer Science)."
    },
    {
      category: "đọc hiểu",
      language: "english",
      description: "Hiểu ý chính",
      questionText: "What is the main idea of the text about Tom?",
      options: ["Tom's hobby", "Tom's education", "Tom's family", "Tom's job"],
      correctAnswer: "1",
      explanation: "Ý chính của đoạn văn là nói về việc học tập của Tom."
    }
  ];

  const createdQuestions = [];
  for (const q of questions) {
    const question = await storage.createQuestion(q);
    createdQuestions.push(question);
  }
  return createdQuestions;
}

async function seedMissingQuestions() {
  // This function can be implemented later if needed for migration
  console.log("Checking for missing questions - implementation pending");
}
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

async function seedMissingQuestions() {
  try {
    const allExams = await storage.getAllExams();
    let fixedCount = 0;

    for (const exam of allExams) {
      const existingQuestions = await storage.getQuestionsByExamId(exam.id);
      
      if (existingQuestions.length === 0 && exam.questionCount > 0) {
        console.log(`Creating ${exam.questionCount} questions for exam: ${exam.title}`);
        
        // Generate questions based on exam type and count
        const questions = [];
        for (let i = 1; i <= exam.questionCount; i++) {
          questions.push({
            examId: exam.id,
            questionText: `Sample question ${i} for ${exam.title}`,
            questionType: "multiple_choice",
            options: [
              `Option A for question ${i}`,
              `Option B for question ${i}`,
              `Option C for question ${i}`,
              `Option D for question ${i}`
            ],
            correctAnswer: Math.floor(Math.random() * 4).toString(),
            explanation: `This is the explanation for question ${i} in ${exam.title}.`,
            sortOrder: i - 1
          });
        }

        // Create all questions for this exam
        for (const questionData of questions) {
          await storage.createQuestion(questionData);
        }
        
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      console.log(`✓ Created questions for ${fixedCount} exams that were missing questions`);
    } else {
      console.log(`✓ All exams already have questions`);
    }
    
  } catch (error) {
    console.error("Error seeding missing questions:", error);
  }
}