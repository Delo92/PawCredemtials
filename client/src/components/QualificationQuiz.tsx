import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnimateOnScroll } from "@/hooks/use-scroll-animation";
import {
  Dog,
  Cat,
  Heart,
  Frown,
  SmilePlus,
  Meh,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface QuizQuestion {
  question: string;
  options: { label: string; icon?: any; value: string; positive?: boolean }[];
}

const questions: QuizQuestion[] = [
  {
    question: "What type of pet(s) do you have?",
    options: [
      { label: "Dog", icon: Dog, value: "dog", positive: true },
      { label: "Cat", icon: Cat, value: "cat", positive: true },
      { label: "Both", icon: Heart, value: "both", positive: true },
    ],
  },
  {
    question: "Does being with your pet help reduce your stress or anxiety?",
    options: [
      { label: "Yes, definitely", icon: SmilePlus, value: "yes", positive: true },
      { label: "Not really", icon: Meh, value: "no", positive: false },
    ],
  },
  {
    question: "Do you ever feel sad or anxious when you're away from your pet?",
    options: [
      { label: "Yes, I do", icon: Frown, value: "yes", positive: true },
      { label: "No, I'm fine", icon: Meh, value: "no", positive: false },
    ],
  },
  {
    question: "In the last 2 weeks, have you experienced stress, anxiety, or trouble sleeping?",
    options: [
      { label: "Sometimes", value: "sometimes", positive: true },
      { label: "Often", value: "often", positive: true },
      { label: "Always", value: "always", positive: true },
      { label: "Never", value: "never", positive: false },
    ],
  },
  {
    question: "Are you over 18 years old?",
    options: [
      { label: "Yes", value: "yes", positive: true },
      { label: "No", value: "no", positive: false },
    ],
  },
];

export default function QualificationQuiz() {
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const positiveCount = answers.reduce((count, answer, idx) => {
    const q = questions[idx];
    const opt = q.options.find((o) => o.value === answer);
    return count + (opt?.positive ? 1 : 0);
  }, 0);

  const qualified = positiveCount >= 3;

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      setTimeout(() => setFinished(true), 300);
    }
  };

  if (!started) {
    return (
      <section className="py-20 md:py-24 bg-[hsl(var(--section-bg))]">
        <div className="container">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-medium section-title-underline" data-testid="text-quiz-title">
                Do You Qualify?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mt-4 text-base mb-8">
                Take our quick 5-question screening to see if you may qualify for an ESA letter. It only takes 30 seconds.
              </p>
              <Button size="lg" onClick={() => setStarted(true)} data-testid="button-start-quiz">
                Take the Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="py-20 md:py-24 bg-[hsl(var(--section-bg))]">
        <div className="container">
          <div className="max-w-lg mx-auto text-center">
            {qualified ? (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="pt-8 pb-8 space-y-4">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                  <h3 className="text-2xl font-bold" data-testid="text-quiz-result">You Likely Qualify!</h3>
                  <p className="text-muted-foreground">
                    Based on your answers, you may be eligible for an ESA letter. A licensed mental health professional will review your full application.
                  </p>
                  <Button size="lg" asChild data-testid="button-quiz-register">
                    <Link href="/register">
                      Get Started Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-8 pb-8 space-y-4">
                  <XCircle className="h-16 w-16 text-amber-500 mx-auto" />
                  <h3 className="text-2xl font-bold" data-testid="text-quiz-result">You May Not Qualify Right Now</h3>
                  <p className="text-muted-foreground">
                    Based on your answers, you may not meet the typical criteria for an ESA letter at this time. However, you can still apply and a licensed professional will evaluate your situation.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => { setStarted(false); setCurrentQuestion(0); setAnswers([]); setFinished(false); }} data-testid="button-quiz-retry">
                      Retake Quiz
                    </Button>
                    <Button asChild data-testid="button-quiz-apply-anyway">
                      <Link href="/register">Apply Anyway</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    );
  }

  const q = questions[currentQuestion];

  return (
    <section className="py-20 md:py-24 bg-[hsl(var(--section-bg))]">
      <div className="container">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2" data-testid="text-quiz-heading">Do You Qualify?</h2>
            <p className="text-sm text-muted-foreground">Question {currentQuestion + 1} of {questions.length}</p>
          </div>
          <Progress value={((currentQuestion + 1) / questions.length) * 100} className="h-2 mb-6" />
          <Card>
            <CardContent className="pt-6 pb-6 space-y-5">
              <h3 className="text-lg font-semibold text-center" data-testid="text-quiz-question">{q.question}</h3>
              <div className="grid gap-3">
                {q.options.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={answers[currentQuestion] === opt.value ? "default" : "outline"}
                    size="lg"
                    className="w-full justify-center gap-2 text-base h-14"
                    onClick={() => handleAnswer(opt.value)}
                    data-testid={`button-quiz-option-${opt.value}`}
                  >
                    {opt.icon && <opt.icon className="h-5 w-5" />}
                    {opt.label}
                  </Button>
                ))}
              </div>
              {currentQuestion > 0 && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentQuestion(currentQuestion - 1)}
                    data-testid="button-quiz-back"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
