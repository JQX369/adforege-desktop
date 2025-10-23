import React, { useState, useEffect, useRef } from 'react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  PanInfo,
} from 'framer-motion'
import {
  Sparkles,
  Heart,
  X,
  ChevronLeft,
  ShoppingBag,
  Gift,
  ArrowRight,
  Star,
  Menu,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Types & Mock Data ---

type ViewState = 'LANDING' | 'QUIZ' | 'LOADING' | 'SWIPE'

type QuizAnswers = {
  relationship: string
  occasion: string
  interests: string[]
  vibe: string
}

interface Product {
  id: string
  title: string
  price: string
  imageColor: string
  category: string
  description: string
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    title: 'Artisan Ceramic Mug Set',
    price: '$45',
    imageColor: 'bg-amber-100',
    category: 'Home',
    description: 'Hand-thrown pottery for their cozy mornings.',
  },
  {
    id: '2',
    title: 'Smart Herb Garden',
    price: '$99',
    imageColor: 'bg-green-100',
    category: 'Tech/Home',
    description: 'Fresh basil year-round with zero effort.',
  },
  {
    id: '3',
    title: 'Weighted Knit Blanket',
    price: '$180',
    imageColor: 'bg-slate-200',
    category: 'Comfort',
    description: 'Like a warm hug after a long day.',
  },
  {
    id: '4',
    title: 'Vintage Vinyl Player',
    price: '$120',
    imageColor: 'bg-rose-100',
    category: 'Music',
    description: 'Modern bluetooth tech with retro soul.',
  },
  {
    id: '5',
    title: 'Japanese Knife Set',
    price: '$250',
    imageColor: 'bg-stone-200',
    category: 'Kitchen',
    description: 'Razor sharp precision for the serious home chef.',
  },
  {
    id: '6',
    title: 'Subscription Coffee Box',
    price: '$30/mo',
    imageColor: 'bg-orange-100',
    category: 'Food & Drink',
    description: 'A world tour of beans delivered monthly.',
  },
]

const INITIAL_ANSWERS: QuizAnswers = {
  relationship: '',
  occasion: '',
  interests: [],
  vibe: '',
}

// --- Main Component ---

export default function FairyWizeApp() {
  const [view, setView] = useState<ViewState>('LANDING')
  const [answers, setAnswers] = useState<QuizAnswers>(INITIAL_ANSWERS)
  const [likedItems, setLikedItems] = useState<Product[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // --- Event Handlers ---
  const startQuiz = () => setView('QUIZ')

  const finishQuiz = async (finalAnswers: QuizAnswers) => {
    setAnswers(finalAnswers)
    setView('LOADING')
    // Fake AI loading time
    setTimeout(() => setView('SWIPE'), 2500)
  }

  const handleLike = (product: Product) => {
    setLikedItems((prev) => [...prev, product])
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-800 font-sans overflow-hidden selection:bg-amber-200">
      {/* Global Header (mostly for Swipe view, but nice to have branding everywhere) */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-stone-100">
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => view !== 'LANDING' && setView('LANDING')}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-amber-300 to-rose-300 rounded-lg flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform">
            <Sparkles className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">
            Fairy Wize
          </span>
        </div>

        {view === 'SWIPE' && (
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="relative p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <ShoppingBag className="w-6 h-6 text-slate-700" />
            {likedItems.length > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0 right-0 w-5 h-5 bg-rose-500 text-white text-xs font-bold flex items-center justify-center rounded-full"
              >
                {likedItems.length}
              </motion.div>
            )}
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="pt-16 min-h-screen">
        <AnimatePresence mode="wait">
          {view === 'LANDING' && (
            <LandingView onStart={startQuiz} key="landing" />
          )}
          {view === 'QUIZ' && (
            <QuizView
              onFinish={finishQuiz}
              onBack={() => setView('LANDING')}
              key="quiz"
            />
          )}
          {view === 'LOADING' && <LoadingView key="loading" />}
          {view === 'SWIPE' && (
            <SwipeDeckView
              products={MOCK_PRODUCTS}
              onLike={handleLike}
              onOpenDrawer={() => setIsDrawerOpen(true)}
              key="swipe"
            />
          )}
        </AnimatePresence>
      </main>

      {/* Saved Drawer Overlay */}
      <SavedDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        items={likedItems}
        onRemove={(id) => setLikedItems(likedItems.filter((i) => i.id !== id))}
      />
    </div>
  )
}

// --- Sub-Views ---

function LandingView({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[90vh] px-6 text-center max-w-4xl mx-auto"
    >
      <div className="mb-8 inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-800 text-sm font-medium">
        <Star className="w-4 h-4 mr-1.5 text-amber-500" fill="currentColor" />
        Trusted by 10,000+ happy gifters
      </div>

      <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 leading-[1.1]">
        Find the{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500">
          perfect gift
        </span>
        <br />
        in minutes, not hours.
      </h1>

      <p className="text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
        Stop doom-scrolling Amazon. Tell our friendly AI who you're shopping
        for, and we'll curate a personalized deck of gifts they'll actually
        love.
      </p>

      <motion.button
        onClick={onStart}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-slate-900 rounded-full overflow-hidden shadow-xl shadow-slate-900/20 transition-all hover:shadow-slate-900/30"
      >
        <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></span>
        <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition duration-500 origin-bottom-left transform rotate-45 translate-x-24 bg-rose-500 opacity-30 group-hover:rotate-90 ease"></span>
        <span className="relative flex items-center gap-2 text-lg">
          Start the Magic <ArrowRight className="w-5 h-5" />
        </span>
      </motion.button>

      {/* Decorative elements */}
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10 animate-blob"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10 animate-blob animation-delay-2000"></div>
    </motion.div>
  )
}

function QuizView({
  onFinish,
  onBack,
}: {
  onFinish: (answers: QuizAnswers) => void
  onBack: () => void
}) {
  const [step, setStep] = useState(1)
  const totalSteps = 4
  const [answers, setAnswers] = useState<QuizAnswers>(INITIAL_ANSWERS)

  const handleSingleSelect = (key: keyof QuizAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      onFinish({ ...answers, [key]: value })
    }
  }

  const handleMultiSelect = (value: string) => {
    setAnswers((prev) => {
      const current = prev.interests
      return current.includes(value)
        ? { ...prev, interests: current.filter((i) => i !== value) }
        : { ...prev, interests: [...current, value] }
    })
  }

  const progress = (step / totalSteps) * 100

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-xl mx-auto px-6 py-8 min-h-[80vh] flex flex-col"
    >
      {/* Progress Bar */}
      <div className="w-full h-2 bg-stone-100 rounded-full mb-8 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-rose-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      {/* Back Button */}
      <button
        onClick={step === 1 ? onBack : () => setStep(step - 1)}
        className="self-start mb-6 text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-medium transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      {/* Quiz Content Container */}
      <div className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <QuizStep key="step1" question="Who is this lucky person to you?">
              {[
                'Partner',
                'Parent',
                'Sibling',
                'Friend',
                'Colleague',
                'Other',
              ].map((opt) => (
                <OptionButton
                  key={opt}
                  selected={answers.relationship === opt}
                  onClick={() => handleSingleSelect('relationship', opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </QuizStep>
          )}

          {step === 2 && (
            <QuizStep key="step2" question="What's the special occasion?">
              {[
                'Birthday',
                'Holiday',
                'Anniversary',
                'Housewarming',
                'Just Because',
              ].map((opt) => (
                <OptionButton
                  key={opt}
                  selected={answers.occasion === opt}
                  onClick={() => handleSingleSelect('occasion', opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </QuizStep>
          )}

          {step === 3 && (
            <QuizStep
              key="step3"
              question="What are they into? (Pick a few)"
              subtitle="The more you pick, the better we get."
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Cooking',
                  'Tech',
                  'Wellness',
                  'Travel',
                  'Art/Design',
                  'Reading',
                  'Fitness',
                  'Music',
                ].map((opt) => (
                  <OptionButton
                    key={opt}
                    multi
                    selected={answers.interests.includes(opt)}
                    onClick={() => handleMultiSelect(opt)}
                  >
                    {opt}
                  </OptionButton>
                ))}
              </div>
              <button
                onClick={() => setStep(step + 1)}
                disabled={answers.interests.length === 0}
                className="mt-8 w-full py-4 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                Continue
              </button>
            </QuizStep>
          )}

          {step === 4 && (
            <QuizStep key="step4" question="What's the vibe & budget?">
              {[
                'Under $50, Fun',
                '$50-$100, Thoughtful',
                '$100+, Impressive',
                'Money is no object',
              ].map((opt) => (
                <OptionButton
                  key={opt}
                  selected={answers.vibe === opt}
                  onClick={() => handleSingleSelect('vibe', opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </QuizStep>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function QuizStep({
  question,
  subtitle,
  children,
}: {
  question: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-3xl font-bold text-slate-900 mb-2">{question}</h2>
      {subtitle && <p className="text-slate-500 mb-6">{subtitle}</p>}
      <div className={cn('flex flex-col gap-3', !subtitle && 'mt-6')}>
        {children}
      </div>
    </motion.div>
  )
}

function OptionButton({
  children,
  selected,
  onClick,
  multi = false,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  multi?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-6 py-4 text-left rounded-xl border-2 font-medium transition-all duration-200',
        selected
          ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-sm'
          : 'border-stone-200 bg-white text-slate-700 hover:border-stone-300 hover:bg-stone-50'
      )}
    >
      <div className="flex items-center justify-between">
        {children}
        {selected && multi && (
          <div className="w-3 h-3 rounded-full bg-amber-500" />
        )}
      </div>
    </button>
  )
}

function LoadingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-[80vh] text-center px-6"
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-24 h-24 bg-gradient-to-tr from-amber-300 to-rose-300 rounded-3xl flex items-center justify-center shadow-lg mb-8"
      >
        <Gift className="w-12 h-12 text-white" />
      </motion.div>
      <h3 className="text-2xl font-bold text-slate-900 mb-3">
        Working our magic...
      </h3>
      <p className="text-slate-500 max-w-sm">
        We're analyzing thousands of gifts to find the ones that perfectly match
        their vibe.
      </p>
    </motion.div>
  )
}

// --- Swipe Deck Implementation ---

function SwipeDeckView({
  products,
  onLike,
  onOpenDrawer,
}: {
  products: Product[]
  onLike: (p: Product) => void
  onOpenDrawer: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(
    null
  )

  // If we ran out of cards
  if (currentIndex >= products.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">
          That's all for now!
        </h3>
        <p className="text-slate-600 mb-8">
          Check your saved items to pick the winner.
        </p>
        <button
          onClick={onOpenDrawer}
          className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800"
        >
          View Saved Gifts
        </button>
      </div>
    )
  }

  const currentProduct = products[currentIndex]
  const nextProduct = products[currentIndex + 1]

  const handleSwipe = (direction: 'left' | 'right') => {
    setExitDirection(direction)
    if (direction === 'right') {
      onLike(currentProduct)
    }

    // Wait for animation to finish before switching index
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setExitDirection(null)
    }, 200) // Match this with the exit duration
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] relative overflow-hidden">
      <div className="relative w-full max-w-md aspect-[3/4] max-h-[65vh] px-4">
        {/* Background/Next Card (for stacking effect) */}
        {nextProduct && (
          <div className="absolute top-4 left-4 right-4 bottom-0 bg-white rounded-3xl shadow-sm border border-stone-100 transform scale-[0.95] translate-y-4 opacity-50 -z-10 flex flex-col overflow-hidden">
            <div className={cn('h-3/5 w-full', nextProduct.imageColor)} />
          </div>
        )}

        {/* Active Draggable Card */}
        <AnimatePresence>
          {/* We only render the current one if we aren't mid-transition of index, 
               but for smoother swipe we rely on AnimatePresence to handle the exit of the old one */}
          <SwipeCard
            key={currentProduct.id}
            product={currentProduct}
            onSwipe={handleSwipe}
            forcedExit={exitDirection}
          />
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-6 mt-8">
        <button
          onClick={() => handleSwipe('left')}
          className="w-16 h-16 flex items-center justify-center bg-white border-2 border-stone-200 text-stone-400 rounded-full shadow-sm transition-all hover:border-rose-300 hover:text-rose-500 hover:scale-110 active:scale-95"
          aria-label="Pass"
        >
          <X className="w-8 h-8" />
        </button>
        <button
          onClick={() => handleSwipe('right')}
          className="w-16 h-16 flex items-center justify-center bg-gradient-to-tr from-rose-400 to-amber-400 text-white rounded-full shadow-lg shadow-rose-200 transition-all hover:scale-110 active:scale-95"
          aria-label="Like"
        >
          <Heart className="w-8 h-8 fill-current" />
        </button>
      </div>

      <p className="text-stone-400 text-sm mt-6 font-medium animate-pulse">
        Swipe left to pass, right to save
      </p>
    </div>
  )
}

function SwipeCard({
  product,
  onSwipe,
  forcedExit,
}: {
  product: Product
  onSwipe: (dir: 'left' | 'right') => void
  forcedExit: 'left' | 'right' | null
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-25, 25])
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0])

  // Haptic visual feedback colors
  const likeOpacity = useTransform(x, [0, 150], [0, 1])
  const nopeOpacity = useTransform(x, [-150, 0], [1, 0])

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100
    if (info.offset.x > threshold) {
      onSwipe('right')
    } else if (info.offset.x < -threshold) {
      onSwipe('left')
    }
  }

  // Programmatic exit variants
  const variants = {
    enter: { x: 0, y: -50, opacity: 0, scale: 0.95 },
    center: {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { duration: 0.3 },
    },
    exitLeft: {
      x: -300,
      opacity: 0,
      rotate: -20,
      transition: { duration: 0.2 },
    },
    exitRight: {
      x: 300,
      opacity: 0,
      rotate: 20,
      transition: { duration: 0.2 },
    },
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity, zIndex: 10 }}
      variants={variants}
      initial="enter"
      animate={
        forcedExit
          ? forcedExit === 'left'
            ? 'exitLeft'
            : 'exitRight'
          : 'center'
      }
      exit={forcedExit === 'left' ? 'exitLeft' : 'exitRight'}
      className="absolute inset-0 w-full h-full bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Swipe Feedback Overlays */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-8 border-4 border-green-500 rounded-lg px-4 py-2 transform -rotate-12 z-20 pointer-events-none"
      >
        <span className="text-green-500 font-extrabold text-3xl uppercase tracking-wider">
          LIKE
        </span>
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-8 right-8 border-4 border-rose-500 rounded-lg px-4 py-2 transform rotate-12 z-20 pointer-events-none"
      >
        <span className="text-rose-500 font-extrabold text-3xl uppercase tracking-wider">
          NOPE
        </span>
      </motion.div>

      {/* Card Content */}
      <div className="h-full flex flex-col">
        {/* Image Placeholder */}
        <div
          className={cn(
            'h-3/5 w-full relative flex items-center justify-center',
            product.imageColor
          )}
        >
          <Gift className="w-24 h-24 text-black/10" />
          <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
            {product.price}
          </div>
        </div>
        <div className="p-6 flex-1 flex flex-col justify-between bg-gradient-to-b from-white to-stone-50">
          <div>
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
              {product.category}
            </div>
            <h3 className="text-2xl font-bold text-slate-900 leading-tight mb-2">
              {product.title}
            </h3>
            <p className="text-slate-600 line-clamp-3">{product.description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// --- Saved Drawer ---

function SavedDrawer({
  isOpen,
  onClose,
  items,
  onRemove,
}: {
  isOpen: boolean
  onClose: () => void
  items: Product[]
  onRemove: (id: string) => void
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Your Shortlist
                </h2>
                <p className="text-slate-500 text-sm">
                  {items.length} items saved
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <Heart className="w-12 h-12 mb-4 text-stone-200" />
                  <p>
                    No saved gifts yet.
                    <br />
                    Start swiping to build your list!
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-4 p-3 rounded-2xl border border-stone-100 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div
                        className={cn(
                          'w-20 h-20 rounded-xl flex-shrink-0',
                          item.imageColor
                        )}
                      />
                      <div className="flex-1 py-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-900">
                            {item.title}
                          </h4>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="text-stone-300 hover:text-rose-500 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-amber-600 font-medium text-sm mb-3">
                          {item.price}
                        </p>
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          className="text-xs font-bold text-slate-900 bg-stone-100 px-3 py-1.5 rounded-full hover:bg-slate-900 hover:text-white transition-colors inline-block"
                        >
                          Buy Now ↗
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-stone-100 bg-stone-50">
                <button className="w-full py-4 bg-gradient-to-r from-amber-400 to-rose-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:brightness-105 transition-all">
                  Share List with Friends
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
