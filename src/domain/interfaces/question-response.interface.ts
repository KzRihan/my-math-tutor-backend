/**
 * Question Response Interface Definitions
 */

export interface IQuestionResponseBase {
  userId: string;
  topicId: string;
  lessonId: string;
  questionIndex: number;
  questionType: 'practice' | 'quiz';
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  xpAwarded: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  topicDifficulty?: 'easy' | 'medium' | 'hard';
  gradeBand?: 'primary' | 'secondary' | 'college';
  answeredAt: Date;
}

export interface IQuestionResponse extends IQuestionResponseBase {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISubmitQuestionAnswer {
  topicId: string;
  lessonId: string;
  questionIndex: number;
  questionType: 'practice' | 'quiz';
  userAnswer: string;
}

export interface IQuestionResponseDTO {
  id: string;
  userId: string;
  topicId: string;
  lessonId: string;
  questionIndex: number;
  questionType: 'practice' | 'quiz';
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  xpAwarded: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  topicDifficulty?: 'easy' | 'medium' | 'hard';
  gradeBand?: 'primary' | 'secondary' | 'college';
  answeredAt: Date;
  createdAt: Date;
}

export interface ISubmitAnswerResponse {
  success: boolean;
  isCorrect: boolean;
  xpAwarded: number;
  totalXPEarned: number; // Total XP for this lesson
  userLevel: number;
  userXP: number;
  message: string;
  correctAnswer?: string; // Show correct answer if wrong
}

