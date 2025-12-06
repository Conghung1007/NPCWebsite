import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Clock, Target, CheckCircle, XCircle, RotateCcw, Home, Share2, BookOpen, MessageSquare, Headphones, FileInput, ArrowLeft } from "lucide-react";
import { type ExamAttempt, type Exam, type Question } from "@shared/schema";

interface ExamResultPageProps {
  attemptId: string;
}

export function ExamResultPage({ attemptId }: ExamResultPageProps) {
  const [, setLocation] = useLocation();

  // Fetch exam attempt details
  const { data: attempt, isLoading: attemptLoading } = useQuery<ExamAttempt>({
    queryKey: [`/api/exam-attempts/${attemptId}`],
    retry: false,
  });

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${attempt?.examId}`],
    enabled: !!attempt,
    retry: false,
  });

  // Fetch questions with answers
  const { data: questionsWithAnswers = [], isLoading: questionsLoading } = useQuery<any[]>({
    queryKey: [`/api/exam-attempts/${attemptId}/details`],
    retry: false,
  });

  // DEBUG: Log received data
  console.log("=== EXAM RESULT PAGE LOADED ===");
  console.log("Attempt:", attempt);
  console.log("Exam:", exam);
  console.log("Questions with answers:", questionsWithAnswers);

  if (attemptLoading || examLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Đang tải kết quả thi...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Không tìm thấy kết quả</h2>
            <p className="text-gray-600 mb-6">
              Kết quả thi này không tồn tại hoặc đã bị xóa.
            </p>
            <Button onClick={() => setLocation("/online-exam")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detect sections format vs legacy format
  const useSections = (exam as any).sections && Array.isArray((exam as any).sections) && (exam as any).sections.length > 0;
  
  // Helper to count questions including sub-questions (kept for backward compatibility)
  const countQuestions = (item: any) => {
    let count = 1; // parent question
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      count += item.question.subQuestions.length;
    }
    return count;
  };
  
  const countCorrect = (item: any) => {
    let correct = 0;
    // Check parent - convert both to string for comparison
    if (String(item.userAnswer) === String(item.question.correctAnswer)) {
      correct++;
    }
    // Check sub-questions - userAnswer is embedded in each sub-question object
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        // userAnswer is directly in the sub object (from backend)
        // Convert both to string for comparison
        if (String(sub.userAnswer) === String(sub.correctAnswer)) {
          correct++;
        }
      });
    }
    return correct;
  };
  
  // Calculate total points available (including sub-questions)
  const calculateTotalPoints = (item: any) => {
    let total = 0;
    // Add parent question points (default to 1 if not set)
    // Parse to number since points come from database as string
    total += parseFloat(item.question.points) || 1;
    // Add sub-questions points
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        total += parseFloat(sub.points) || 1;
      });
    }
    return total;
  };
  
  // Calculate earned points from correct answers (including sub-questions)
  const calculateEarnedPoints = (item: any) => {
    let earned = 0;
    
    // Debug logging
    console.log("=== calculateEarnedPoints ===");
    console.log("Parent question:", {
      id: item.question.id,
      userAnswer: item.userAnswer,
      userAnswerType: typeof item.userAnswer,
      correctAnswer: item.question.correctAnswer,
      correctAnswerType: typeof item.question.correctAnswer,
      points: item.question.points
    });
    
    // Check parent - convert both to string for comparison
    if (String(item.userAnswer) === String(item.question.correctAnswer)) {
      // Parse to number since points come from database as string
      const points = parseFloat(item.question.points) || 1;
      earned += points;
      console.log(`✓ Parent correct! Added ${points} points`);
    } else {
      console.log("✗ Parent incorrect");
    }
    
    // Check sub-questions - userAnswer is embedded in each sub-question object
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any, idx: number) => {
        console.log(`Sub-question ${idx}:`, {
          id: sub.id,
          userAnswer: sub.userAnswer,
          userAnswerType: typeof sub.userAnswer,
          correctAnswer: sub.correctAnswer,
          correctAnswerType: typeof sub.correctAnswer,
          points: sub.points
        });
        
        // userAnswer is directly in the sub object (from backend)
        // Convert both to string for comparison
        if (String(sub.userAnswer) === String(sub.correctAnswer)) {
          const points = parseFloat(sub.points) || 1;
          earned += points;
          console.log(`✓ Sub-question ${idx} correct! Added ${points} points`);
        } else {
          console.log(`✗ Sub-question ${idx} incorrect`);
        }
      });
    }
    
    console.log(`Total earned: ${earned} points`);
    return earned;
  };
  
  // Group questions by sections (new format)
  let sectionGroups: any[] = [];
  let totalTimeLimit = 0;
  
  if (useSections) {
    // New sections format
    sectionGroups = (exam as any).sections.map((section: any, sectionIdx: number) => {
      // Extract question IDs from either questionSets (new) or questionIds (legacy)
      let sectionQuestionIds: string[] = [];
      
      if (section.questionSets && Array.isArray(section.questionSets)) {
        // New structure: flatten all questions from all question sets
        sectionQuestionIds = section.questionSets.flatMap((qs: any) => 
          qs.questionIds || []
        );
      } else if (section.questionIds) {
        // Legacy structure: use questionIds directly
        sectionQuestionIds = section.questionIds;
      }
      
      const sectionQuestions = questionsWithAnswers.filter(item => 
        sectionQuestionIds.includes(item.question.id)
      );
      
      // Calculate section stats based on points
      let sectionTotalPoints = 0;
      let sectionEarnedPoints = 0;
      let sectionTotalQuestions = 0;
      let sectionCorrect = 0;
      
      sectionQuestions.forEach(item => {
        sectionTotalPoints += calculateTotalPoints(item);
        sectionEarnedPoints += calculateEarnedPoints(item);
        sectionTotalQuestions += countQuestions(item); // Keep for display
        sectionCorrect += countCorrect(item); // Keep for display
      });
      
      const sectionScore = sectionTotalPoints > 0 
        ? (sectionEarnedPoints / sectionTotalPoints) * 100 
        : 0;
      
      // Determine if section passed based on passing score (now compares points)
      const sectionPassingScore = section.passingScore;
      const sectionPassed = (sectionPassingScore == null || sectionPassingScore === undefined) ? true : sectionEarnedPoints >= sectionPassingScore;
      
      return {
        id: section.id,
        title: section.sectionName || section.type || `Phần ${sectionIdx + 1}`,
        content: section.content,
        timeLimit: section.timeLimit || 0,
        passingScore: sectionPassingScore,
        questions: sectionQuestions,
        totalQuestions: sectionTotalQuestions,
        correctAnswers: sectionCorrect,
        totalPoints: sectionTotalPoints,
        earnedPoints: sectionEarnedPoints,
        score: sectionScore,
        passed: sectionPassed
      };
    });
    
    totalTimeLimit = (exam as any).sections.reduce((sum: number, s: any) => sum + (s.timeLimit || 0), 0);
  } else {
    // Legacy format - create groups from legacy fields
    const legacySections = [
      { 
        key: 'vocabulary', 
        title: 'Từ vựng',
        questionIds: (exam as any).vocabularyQuestions || [],
        timeLimit: (exam as any).vocabularyTimeLimit || 0
      },
      { 
        key: 'grammar', 
        title: 'Ngữ pháp',
        questionIds: (exam as any).grammarQuestions || [],
        timeLimit: (exam as any).grammarTimeLimit || 0
      },
      { 
        key: 'listening', 
        title: 'Nghe hiểu',
        questionIds: (exam as any).listeningQuestions || [],
        timeLimit: (exam as any).listeningTimeLimit || 0
      },
      { 
        key: 'reading', 
        title: 'Đọc hiểu',
        questionIds: (exam as any).readingQuestions || [],
        timeLimit: (exam as any).readingTimeLimit || 0
      }
    ];
    
    sectionGroups = legacySections
      .filter(section => section.questionIds.length > 0)
      .map(section => {
        const sectionQuestions = questionsWithAnswers.filter(item => 
          section.questionIds.includes(item.question.id)
        );
        
        let sectionTotalPoints = 0;
        let sectionEarnedPoints = 0;
        let sectionTotalQuestions = 0;
        let sectionCorrect = 0;
        
        sectionQuestions.forEach(item => {
          sectionTotalPoints += calculateTotalPoints(item);
          sectionEarnedPoints += calculateEarnedPoints(item);
          sectionTotalQuestions += countQuestions(item); // Keep for display
          sectionCorrect += countCorrect(item); // Keep for display
        });
        
        const sectionScore = sectionTotalPoints > 0 
          ? (sectionEarnedPoints / sectionTotalPoints) * 100 
          : 0;
        
        // Legacy sections don't have passing scores
        return {
          id: section.key,
          title: section.title,
          timeLimit: section.timeLimit,
          passingScore: undefined,
          questions: sectionQuestions,
          totalQuestions: sectionTotalQuestions,
          correctAnswers: sectionCorrect,
          totalPoints: sectionTotalPoints,
          earnedPoints: sectionEarnedPoints,
          score: sectionScore,
          passed: true // Legacy sections always pass
        };
      });
    
    totalTimeLimit = ((exam as any).vocabularyTimeLimit || 0) + ((exam as any).grammarTimeLimit || 0) + ((exam as any).listeningTimeLimit || 0) + ((exam as any).readingTimeLimit || 0);
  }
  
  // Calculate overall stats based on points
  const totalQuestions = sectionGroups.reduce((sum, section) => sum + section.totalQuestions, 0);
  const correctAnswers = sectionGroups.reduce((sum, section) => sum + section.correctAnswers, 0);
  const totalPoints = sectionGroups.reduce((sum, section) => sum + section.totalPoints, 0);
  const earnedPoints = sectionGroups.reduce((sum, section) => sum + section.earnedPoints, 0);
  const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  
  // Determine overall exam pass/fail status
  const examPassingScore = (exam as any).passingScore;
  const allSectionsPassed = sectionGroups.every(section => section.passed);
  const failedSections = sectionGroups.filter(section => !section.passed);
  
  let examPassed = false;
  let failureReason = "";
  
  if (!allSectionsPassed) {
    // If any section failed, exam fails
    examPassed = false;
    failureReason = `Không đạt do không đạt điểm tối thiểu tại: ${failedSections.map(s => s.title).join(", ")}`;
  } else if (examPassingScore != null && examPassingScore > 0 && earnedPoints < examPassingScore) {
    // All sections passed but total points not enough
    examPassed = false;
    failureReason = `Không đạt do tổng điểm (${earnedPoints}) thấp hơn điểm đạt của bài thi (${examPassingScore})`;
  } else {
    // Either no passing score requirements or all requirements met
    examPassed = true;
  }

  const totalTimeMinutes = Math.floor(attempt.totalTimeSpent / 60);
  const totalTimeSeconds = attempt.totalTimeSpent % 60;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreBadge = (percentage: number) => {
    if (percentage >= 90) return { text: "Xuất sắc", variant: "default" as const, color: "bg-green-600" };
    if (percentage >= 80) return { text: "Tốt", variant: "secondary" as const, color: "bg-blue-600" };
    if (percentage >= 60) return { text: "Khá", variant: "outline" as const, color: "bg-yellow-600" };
    return { text: "Không đạt", variant: "destructive" as const, color: "bg-red-600" };
  };

  // Determine badge based on pass/fail status
  let scoreBadge;
  if (examPassed) {
    scoreBadge = getScoreBadge(attempt.totalScore);
  } else {
    scoreBadge = { text: "Không đạt", variant: "destructive" as const, color: "bg-red-600" };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full ${scoreBadge.color} flex items-center justify-center`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-green-700 mb-4">{exam.title}</h1>
          <h2 className="text-2xl font-bold text-green-700 mb-1">TRI NHAN ONLINE ⽇本語能⼒試験</h2>
          <h3 className="text-lg font-semibold text-green-600 mb-2">確定結果及び成績に関する証明書。</h3>
          <h4 className="text-xl font-bold text-green-700 mb-1">TRI NHAN ONLINE JAPANESE - LANGUAGE PROFICIENCY TEST</h4>
          <h5 className="text-base font-semibold text-green-600 mb-3">CERTICATE OF RESULT AND SCORES</h5>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className={`text-3xl font-bold ${examPassed ? 'text-green-600' : 'text-red-600'} whitespace-nowrap`}>
                {examPassed ? 'Đạt' : 'Không đạt'}
              </div>
              <p className="text-sm text-gray-600 mt-1 whitespace-nowrap">Kết quả</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 mr-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {totalTimeMinutes}:{totalTimeSeconds.toString().padStart(2, '0')}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Thời gian làm bài</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600 mr-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {totalTimeLimit}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Giới hạn (phút)</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">
                {new Date(attempt.completedAt).toLocaleDateString("vi-VN")}
              </div>
              <p className="text-sm text-gray-600 mt-1">Ngày thi</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Visualization */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Chi tiết kết quả
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Điểm số đạt được</span>
                  <span className={getScoreColor(scorePercentage)}>
                    {earnedPoints.toFixed(1)}/{totalPoints.toFixed(1)} điểm ({scorePercentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={scorePercentage} className="h-3" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm">
                    <strong>{earnedPoints.toFixed(1)}</strong> điểm đạt được
                  </span>
                </div>
                <div className="flex items-center">
                  <XCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm">
                    <strong>{(totalPoints - earnedPoints).toFixed(1)}</strong> điểm bị mất
                  </span>
                </div>
              </div>
              
              {/* Passing score information */}
              {examPassingScore != null && examPassingScore > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Điểm đạt yêu cầu của bài thi:</span>
                    <span className="font-semibold">{examPassingScore} điểm</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Trạng thái:</span>
                    <Badge variant={examPassed ? "default" : "destructive"}>
                      {examPassed ? "Đạt" : "Không đạt"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Failure reason message */}
        {!examPassed && failureReason && (
          <Card className="mb-8 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start">
                <XCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Lý do không đạt</h3>
                  <p className="text-sm text-red-800">{failureReason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Details with Questions */}
        {sectionGroups.length > 0 && sectionGroups.map((section, sectionIdx) => (
          <Card key={section.id} className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">
                    {section.title}
                    {section.content && <span className="text-sm font-normal text-gray-600 ml-2">- {section.content}</span>}
                  </CardTitle>
                  {section.passingScore != null && section.passingScore > 0 && (
                    <Badge variant={section.passed ? "default" : "destructive"} className="ml-2">
                      {section.passed ? "Đạt" : "Không đạt"}
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${section.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {section.passed ? 'Đạt' : 'Không đạt'}
                  </div>
                  <div className="text-xs text-gray-600">
                    {section.earnedPoints.toFixed(1)}/{section.totalPoints.toFixed(1)} điểm
                    {section.passingScore != null && section.passingScore > 0 && (
                      <span className="ml-1">(yêu cầu: {section.passingScore} điểm)</span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {section.questions.map((item: any, qIdx: number) => {
                  const hasSubQuestions = item.question.subQuestions && item.question.subQuestions.length > 0;
                  
                  return (
                    <div key={item.question.id} className="border-b pb-6 last:border-b-0">
                      {/* Parent Question Description (if has sub-questions) */}
                      {hasSubQuestions && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          {item.question.description && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {item.question.description}
                              </p>
                            </div>
                          )}
                          
                          {/* Parent Description Images */}
                          {item.question.descriptionImageUrls && item.question.descriptionImageUrls.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-3">
                              {item.question.descriptionImageUrls.map((imgUrl: string, imgIdx: number) => (
                                <img
                                  key={imgIdx}
                                  src={imgUrl}
                                  alt={`Description ${imgIdx + 1}`}
                                  className="max-w-sm h-auto rounded-lg border"
                                />
                              ))}
                            </div>
                          )}
                          
                          {/* Parent Description Audio */}
                          {item.question.descriptionAudioUrl && (
                            <div className="mb-3">
                              <audio controls className="w-full max-w-md">
                                <source src={item.question.descriptionAudioUrl} type="audio/mpeg" />
                              </audio>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Parent Question */}
                      <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            Câu {qIdx + 1}{hasSubQuestions ? '.1' : ''}: {item.question.questionText}
                          </h4>
                          <div className="flex items-center ml-4">
                            {item.userAnswer === item.question.correctAnswer ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                        </div>
                        
                        {/* Parent Question Images */}
                        {item.question.imageUrls && item.question.imageUrls.length > 0 && (
                          <div className="flex flex-wrap gap-3 mb-4">
                            {item.question.imageUrls.map((imgUrl: string, imgIdx: number) => (
                              <img
                                key={imgIdx}
                                src={imgUrl}
                                alt={`Question ${imgIdx + 1}`}
                                className="max-w-sm h-auto rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                        
                        {item.question.imageUrl && (
                          <div className="mb-4">
                            <img
                              src={item.question.imageUrl}
                              alt="Question illustration"
                              className="max-w-sm h-auto rounded-lg"
                            />
                          </div>
                        )}

                        <div className="space-y-2 text-sm">
                          {(item.question.options as any[]).map((option, optionIndex) => {
                            const isUserAnswer = item.userAnswer === optionIndex.toString();
                            const isCorrectAnswer = item.question.correctAnswer === optionIndex.toString();
                            const optionText = typeof option === 'string' ? option : option.text;
                            
                            return (
                              <div
                                key={optionIndex}
                                className={`p-2 rounded ${
                                  isCorrectAnswer
                                    ? 'bg-green-100 border border-green-300'
                                    : isUserAnswer
                                      ? 'bg-red-100 border border-red-300'
                                      : 'bg-gray-50'
                                }`}
                              >
                                <span className="font-medium">
                                  {String.fromCharCode(65 + optionIndex)}.
                                </span>{' '}
                                {optionText}
                                {isCorrectAnswer && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Đáp án đúng
                                  </Badge>
                                )}
                                {isUserAnswer && !isCorrectAnswer && (
                                  <Badge variant="destructive" className="ml-2 text-xs">
                                    Bạn đã chọn
                                  </Badge>
                                )}
                                {isUserAnswer && isCorrectAnswer && (
                                  <Badge className="ml-2 text-xs bg-green-600">
                                    Bạn đã chọn đúng
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {item.question.explanation && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>Giải thích:</strong> {item.question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Sub-Questions */}
                      {hasSubQuestions && (
                        <div className="space-y-4">
                          {item.question.subQuestions.map((subQ: any, subIdx: number) => {
                            const isSubCorrect = subQ.userAnswer === subQ.correctAnswer;
                            
                            return (
                              <div key={subQ.id}>
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="font-medium text-gray-900">
                                    Câu {qIdx + 1}.{subIdx + 2}: {subQ.questionText}
                                  </h5>
                                  <div className="flex items-center ml-4">
                                    {isSubCorrect ? (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Sub-Question Images */}
                                {subQ.imageUrls && subQ.imageUrls.length > 0 && (
                                  <div className="flex flex-wrap gap-3 mb-4">
                                    {subQ.imageUrls.map((imgUrl: string, imgIdx: number) => (
                                      <img
                                        key={imgIdx}
                                        src={imgUrl}
                                        alt={`Sub-question ${imgIdx + 1}`}
                                        className="max-w-sm h-auto rounded-lg"
                                      />
                                    ))}
                                  </div>
                                )}

                                <div className="space-y-2 text-sm">
                                  {(subQ.options as any[]).map((option, optionIndex) => {
                                    const isUserAnswer = subQ.userAnswer === optionIndex.toString();
                                    const isCorrectAnswer = subQ.correctAnswer === optionIndex.toString();
                                    const optionText = typeof option === 'string' ? option : option.text;
                                    
                                    return (
                                      <div
                                        key={optionIndex}
                                        className={`p-2 rounded ${
                                          isCorrectAnswer
                                            ? 'bg-green-100 border border-green-300'
                                            : isUserAnswer
                                              ? 'bg-red-100 border border-red-300'
                                              : 'bg-gray-50'
                                        }`}
                                      >
                                        <span className="font-medium">
                                          {String.fromCharCode(65 + optionIndex)}.
                                        </span>{' '}
                                        {optionText}
                                        {isCorrectAnswer && (
                                          <Badge variant="secondary" className="ml-2 text-xs">
                                            Đáp án đúng
                                          </Badge>
                                        )}
                                        {isUserAnswer && !isCorrectAnswer && (
                                          <Badge variant="destructive" className="ml-2 text-xs">
                                            Bạn đã chọn
                                          </Badge>
                                        )}
                                        {isUserAnswer && isCorrectAnswer && (
                                          <Badge className="ml-2 text-xs bg-green-600">
                                            Bạn đã chọn đúng
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {subQ.explanation && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                      <strong>Giải thích:</strong> {subQ.explanation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          
          <Link href="/online-exam">
            <Button variant="outline" className="w-full sm:w-auto">
              <Home className="w-4 h-4 mr-2" />
              Về trang chủ
            </Button>
          </Link>
          
          <Link href={`/exam/${exam.id}`}>
            <Button className="w-full sm:w-auto">
              <RotateCcw className="w-4 h-4 mr-2" />
              Thi lại
            </Button>
          </Link>
          
          <Button
            variant="outline"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Kết quả thi: ${exam.title}`,
                  text: `Tôi vừa hoàn thành bài thi "${exam.title}" với kết quả ${scorePercentage.toFixed(1)}% (${earnedPoints.toFixed(1)}/${totalPoints.toFixed(1)} điểm)`,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                // You could add a toast notification here
              }
            }}
            className="w-full sm:w-auto"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Chia sẻ kết quả
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ExamResultPage;