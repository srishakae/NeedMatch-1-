import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Filter,
  Gauge,
  Handshake,
  Heart,
  Home,
  Image,
  IndianRupee,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PackageOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"

type Page =
  | "home"
  | "browse"
  | "post"
  | "detail"
  | "compare"
  | "requirements"
  | "offers"
  | "negotiation"
  | "dashboard"
  | "overview"
  | "listing-form"
type RequirementStatus = "Open" | "Receiving Offers" | "Shortlisting" | "Under Negotiation" | "Selected" | "Closed"
type Urgency = "Low" | "Medium" | "High"

type Requirement = {
  id: string
  title: string
  category: string
  description: string
  budgetMin: number
  budgetMax: number
  deadline: string
  urgency: Urgency
  tags: string[]
  status: RequirementStatus
  createdAt: string
  selectedOfferId?: string
}

type Offer = {
  id: string
  requirementId: string
  providerName: string
  price: number
  deliveryDays: number
  message: string
  shortlisted: boolean
  status: "Active" | "Negotiating" | "Selected" | "Not selected"
  createdAt: string
  providerStats: {
    completion: number
    onTime: number
    response: number
    jobs: number
  }
  demoScore?: Score
  demoTrust?: number
  rankExplanation?: string
}

type Listing = {
  id: string
  name: string
  category: string
  description: string
  startingPrice: number
  deliveryDays: number
  tags: string[]
  availability: "Available" | "Limited availability" | "Unavailable"
  image?: string
  documentName?: string
  status: "Published" | "Paused"
  createdAt: string
}

type NegotiationMessage = {
  id: string
  requirementId: string
  offerId: string
  sender: "Requester" | "Provider"
  text: string
  createdAt: string
  proposal?: { price: number; deliveryDays: number }
  accepted?: boolean
}

type Data = {
  requirements: Requirement[]
  offers: Offer[]
  messages: NegotiationMessage[]
  listings: Listing[]
}

type Score = {
  overall: number
  budget: number
  delivery: number
  relevance: number
}

const STORAGE_KEY = "needmatch-v1"
const EMPTY_DATA: Data = {
  requirements: [],
  offers: [],
  messages: [],
  listings: [],
}
const categories = [
  "Design",
  "Design & Branding",
  "Development",
  "Marketing",
  "Writing",
  "Events",
  "Other",
]
const navItems: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Browse", icon: Search },
  { id: "dashboard", label: "Workspace", icon: LayoutDashboard },
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "offers", label: "My Offers", icon: Handshake },
]

const cn = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ")
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`
const uid = () => crypto.randomUUID()
const daysUntil = (date: string) =>
  Math.max(
    1,
    Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000),
  )

function scoreOffer(
  requirement: Requirement,
  offer: Offer,
  adjustedMax = requirement.budgetMax,
): Score {
  if (offer.demoScore && adjustedMax === requirement.budgetMax)
    return offer.demoScore
  const max = Math.max(requirement.budgetMin, adjustedMax)
  let budget = 100
  if (offer.price < requirement.budgetMin) budget = 94
  if (offer.price > max)
    budget = Math.max(10, 100 - ((offer.price - max) / max) * 150)
  const targetDays = daysUntil(requirement.deadline)
  const delivery =
    offer.deliveryDays <= targetDays
      ? Math.min(
          100,
          88 + ((targetDays - offer.deliveryDays) / targetDays) * 20,
        )
      : Math.max(12, 82 - ((offer.deliveryDays - targetDays) / targetDays) * 75)
  const source = `${requirement.title} ${requirement.category} ${requirement.description} ${requirement.tags.join(" ")}`
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "need",
    "looking",
    "from",
  ])
  const words = Array.from(
    new Set(
      source
        .toLowerCase()
        .match(/[a-z]{3,}/g)
        ?.filter((word) => !stop.has(word)) ?? [],
    ),
  )
  const message = offer.message.toLowerCase()
  const matches = words.filter((word) => message.includes(word)).length
  const relevance = Math.min(100, 58 + matches * 7)
  return {
    overall: Math.round(budget * 0.45 + delivery * 0.3 + relevance * 0.25),
    budget: Math.round(budget),
    delivery: Math.round(delivery),
    relevance: Math.round(relevance),
  }
}

function trustScore(offer: Offer) {
  if (offer.demoTrust) return offer.demoTrust
  const { completion, onTime, response } = offer.providerStats
  return Math.round(completion * 0.4 + onTime * 0.35 + response * 0.25)
}

function futureDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function createDemoData(): Data {
  const createdAt = new Date().toISOString()
  const logoRequirement: Requirement = {
    id: "demo-logo-requirement",
    title: "Need a custom logo + brand kit for college fest",
    category: "Design & Branding",
    description:
      "Looking for a modern, minimal logo and basic brand kit (color palette + fonts) for our college technical fest. Prefer a clean and professional style.",
    budgetMin: 3000,
    budgetMax: 5000,
    deadline: futureDate(5),
    urgency: "High",
    tags: ["Logo", "Branding", "College Event"],
    status: "Shortlisting",
    createdAt,
  }
  const websiteRequirement: Requirement = {
    id: "demo-website-requirement",
    title: "College Website Development",
    category: "Development",
    description:
      "A responsive event website with registration, schedule and speaker sections.",
    budgetMin: 15000,
    budgetMax: 22000,
    deadline: futureDate(12),
    urgency: "Medium",
    tags: ["React", "Events", "Responsive"],
    status: "Under Negotiation",
    createdAt,
  }
  const posterRequirement: Requirement = {
    id: "demo-poster-requirement",
    title: "Event Poster Design",
    category: "Design & Branding",
    description:
      "A bold digital poster system for our annual student cultural showcase.",
    budgetMin: 2000,
    budgetMax: 3000,
    deadline: futureDate(4),
    urgency: "High",
    tags: ["Poster", "Event", "Social Media"],
    status: "Selected",
    createdAt,
    selectedOfferId: "demo-poster-offer",
  }
  const providerStats = {
    completion: 93,
    onTime: 90,
    response: 91,
    jobs: 48,
  }
  return {
    requirements: [logoRequirement, websiteRequirement, posterRequirement],
    offers: [
      {
        id: "demo-studio-nova",
        requirementId: logoRequirement.id,
        providerName: "Studio Nova",
        price: 4200,
        deliveryDays: 3,
        message:
          "I will deliver a complete logo and brand kit with three concepts, source files, color palette and typography guidelines.",
        shortlisted: true,
        status: "Active",
        createdAt,
        providerStats,
        demoTrust: 91,
        demoScore: {
          overall: 94,
          budget: 96,
          delivery: 95,
          relevance: 92,
        },
        rankExplanation:
          "Ranked #1 because it is within budget, delivers 2 days early, and strongly matches the requirement.",
      },
      {
        id: "demo-pixelcraft",
        requirementId: logoRequirement.id,
        providerName: "PixelCraft",
        price: 4700,
        deliveryDays: 4,
        message:
          "A polished visual identity with logo concepts, brand colors, fonts and social media assets.",
        shortlisted: false,
        status: "Active",
        createdAt,
        providerStats: { ...providerStats, jobs: 31, onTime: 85 },
        demoTrust: 87,
        demoScore: {
          overall: 89,
          budget: 90,
          delivery: 89,
          relevance: 88,
        },
      },
      {
        id: "demo-creativehub",
        requirementId: logoRequirement.id,
        providerName: "CreativeHub",
        price: 5800,
        deliveryDays: 6,
        message:
          "Professional logo design with brand guidelines and an extended social media kit.",
        shortlisted: false,
        status: "Active",
        createdAt,
        providerStats: { ...providerStats, jobs: 22, completion: 84 },
        demoTrust: 82,
        demoScore: {
          overall: 67,
          budget: 52,
          delivery: 58,
          relevance: 86,
        },
        rankExplanation:
          "Lower match because the offer exceeds the requested budget and deadline.",
      },
      {
        id: "demo-website-offer",
        requirementId: websiteRequirement.id,
        providerName: "Studio Nova",
        price: 18000,
        deliveryDays: 7,
        message:
          "Responsive React website with registration flow, CMS-ready content and launch support.",
        shortlisted: true,
        status: "Negotiating",
        createdAt,
        providerStats,
        demoTrust: 91,
        demoScore: {
          overall: 87,
          budget: 90,
          delivery: 86,
          relevance: 82,
        },
      },
      {
        id: "demo-poster-offer",
        requirementId: posterRequirement.id,
        providerName: "Studio Nova",
        price: 2500,
        deliveryDays: 2,
        message:
          "A complete event poster and social media adaptation package.",
        shortlisted: true,
        status: "Selected",
        createdAt,
        providerStats,
        demoTrust: 91,
        demoScore: {
          overall: 91,
          budget: 94,
          delivery: 92,
          relevance: 85,
        },
      },
    ],
    messages: [],
    listings: [
      {
        id: "demo-listing",
        name: "Logo & Brand Identity Package",
        category: "Design & Branding",
        description:
          "Professional logo and complete brand identity package designed for college events, student organizations and startups.",
        startingPrice: 4000,
        deliveryDays: 4,
        tags: ["Logo", "Branding", "College Events"],
        availability: "Available",
        status: "Published",
        createdAt,
      },
    ],
  }
}

function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  className?: string
  type?: "button" | "submit"
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn("btn", `btn-${variant}`, className)}
    >
      {children}
    </button>
  )
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "success" | "warning" | "danger" | "dark"
}) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
}: {
  icon: typeof Search
  title: string
  copy: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} strokeWidth={1.6} />
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  )
}

function StatusBadge({ status }: { status: RequirementStatus }) {
  const tone =
    status === "Selected" || status === "Closed"
      ? "success"
      : status === "Under Negotiation" || status === "Shortlisting"
        ? "warning"
        : "neutral"
  return <Badge tone={tone}>{status}</Badge>
}

function App() {
  const [data, setData] = useState<Data>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return EMPTY_DATA
      const parsed = JSON.parse(saved) as Partial<Data>
      return {
        requirements: parsed.requirements ?? [],
        offers: parsed.offers ?? [],
        messages: parsed.messages ?? [],
        listings: parsed.listings ?? [],
      }
    } catch {
      return EMPTY_DATA
    }
  })
  const [page, setPage] = useState<Page>("home")
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>()
  const [selectedOfferId, setSelectedOfferId] = useState<string>()
  const [selectedListingId, setSelectedListingId] = useState<string>()
  const [listingMode, setListingMode] = useState<"create" | "edit" | "view">(
    "create",
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string>()

  useEffect(
    () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
    [data],
  )
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(undefined), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const notify = (message: string) => setToast(message)
  const loadDemo = () => {
    setData(createDemoData())
    setSelectedRequirementId("demo-logo-requirement")
    notify("Demo scenario loaded — start with the featured requirement")
  }
  const clearDemo = () => {
    setData(EMPTY_DATA)
    setSelectedRequirementId(undefined)
    setSelectedOfferId(undefined)
    notify("Demo data cleared")
  }
  const openListing = (
    mode: "create" | "edit" | "view",
    listingId?: string,
  ) => {
    setListingMode(mode)
    setSelectedListingId(listingId)
    navigate("listing-form")
  }
  const navigate = (next: Page) => {
    setPage(next)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const openRequirement = (id: string) => {
    setSelectedRequirementId(id)
    navigate("detail")
  }
  const openNegotiation = (requirementId: string, offerId: string) => {
    setSelectedRequirementId(requirementId)
    setSelectedOfferId(offerId)
    setData((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.id === requirementId
          ? item.status === "Selected" || item.status === "Closed"
            ? item
            : { ...item, status: "Under Negotiation" }
          : item,
      ),
      offers: current.offers.map((item) =>
        item.id === offerId && item.status !== "Selected"
          ? { ...item, status: "Negotiating" }
          : item,
      ),
    }))
    navigate("negotiation")
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate("home")}
            aria-label="NeedMatch home"
          >
            <span className="brand-mark">
              <Target size={19} strokeWidth={1.8} />
            </span>
            <span>NeedMatch</span>
          </button>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={cn("nav-link", page === item.id && "active")}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <Button
              variant="secondary"
              className="desktop-only"
              onClick={() => navigate("browse")}
            >
              <Handshake size={17} /> Submit an offer
            </Button>
            <Button onClick={() => navigate("post")}>
              <Plus size={17} />{" "}
              <span className="desktop-only">Post a requirement</span>
              <span className="mobile-only">Post</span>
            </Button>
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open menu"
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mobile-menu"
            >
              {navItems.map((item) => (
                <button key={item.id} onClick={() => navigate(item.id)}>
                  <item.icon size={18} /> {item.label}
                </button>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${page}-${selectedRequirementId ?? ""}-${selectedOfferId ?? ""}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.22 }}
          >
            {page === "home" && (
              <HomePage
                data={data}
                navigate={navigate}
                openRequirement={openRequirement}
                loadDemo={loadDemo}
                clearDemo={clearDemo}
              />
            )}
            {page === "browse" && (
              <BrowsePage
                data={data}
                openRequirement={openRequirement}
                navigate={navigate}
                openListing={openListing}
                loadDemo={loadDemo}
              />
            )}
            {page === "post" && (
              <PostRequirement
                onSubmit={(requirement) => {
                  setData((current) => ({
                    ...current,
                    requirements: [requirement, ...current.requirements],
                  }))
                  setSelectedRequirementId(requirement.id)
                  notify("Requirement published successfully")
                  navigate("detail")
                }}
              />
            )}
            {page === "detail" && (
              <RequirementDetail
                data={data}
                requirementId={selectedRequirementId}
                setData={setData}
                notify={notify}
                navigate={navigate}
                openNegotiation={openNegotiation}
              />
            )}
            {page === "compare" && (
              <Comparison
                data={data}
                requirementId={selectedRequirementId}
                setData={setData}
                notify={notify}
                openNegotiation={openNegotiation}
              />
            )}
            {page === "requirements" && (
              <MyRequirements
                data={data}
                openRequirement={openRequirement}
                navigate={navigate}
              />
            )}
            {page === "offers" && (
              <MyOffers
                data={data}
                setData={setData}
                notify={notify}
                openRequirement={openRequirement}
                navigate={navigate}
                openNegotiation={openNegotiation}
              />
            )}
            {page === "dashboard" && (
              <Workspace
                data={data}
                openRequirement={openRequirement}
                navigate={navigate}
                openListing={openListing}
                setData={setData}
                notify={notify}
                loadDemo={loadDemo}
                clearDemo={clearDemo}
              />
            )}
            {page === "overview" && (
              <Overview
                data={data}
                openRequirement={openRequirement}
                navigate={navigate}
                loadDemo={loadDemo}
              />
            )}
            {page === "listing-form" && (
              <ListingEditor
                listing={data.listings.find(
                  (item) => item.id === selectedListingId,
                )}
                mode={listingMode}
                onCancel={() => navigate("dashboard")}
                onSave={(listing) => {
                  setData((current) => ({
                    ...current,
                    listings: current.listings.some(
                      (item) => item.id === listing.id,
                    )
                      ? current.listings.map((item) =>
                          item.id === listing.id ? listing : item,
                        )
                      : [listing, ...current.listings],
                  }))
                  notify(
                    listingMode === "edit"
                      ? "Listing updated successfully"
                      : "Listing published successfully",
                  )
                  navigate("dashboard")
                }}
                onEdit={() => setListingMode("edit")}
              />
            )}
            {page === "negotiation" && (
              <Negotiation
                data={data}
                requirementId={selectedRequirementId}
                offerId={selectedOfferId}
                setData={setData}
                notify={notify}
                navigate={navigate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 10, x: "-50%" }}
          >
            <CheckCircle2 size={19} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HomePage({
  data,
  navigate,
  openRequirement,
  loadDemo,
  clearDemo,
}: {
  data: Data
  navigate: (page: Page) => void
  openRequirement: (id: string) => void
  loadDemo: () => void
  clearDemo: () => void
}) {
  const recent = data.requirements
    .filter((item) => item.status !== "Closed")
    .slice(0, 3)
  return (
    <>
      <section className="hero">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <Badge tone="dark">
              <Sparkles size={13} /> A smarter way to find the right fit
            </Badge>
            <h1>
              Post what you need.
              <br />
              <em>Let the best offer find you.</em>
            </h1>
            <p>
              Stop searching. Describe your requirement once, compare
              intelligent matches, and confidently choose the provider who fits
              best.
            </p>
            <div className="hero-actions">
              <Button onClick={() => navigate("post")}>
                Post a requirement <ArrowRight size={18} />
              </Button>
              <Button variant="secondary" onClick={() => navigate("browse")}>
                Browse open needs
              </Button>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={15} /> Free to post
              </span>
              <span>
                <Check size={15} /> Transparent matching
              </span>
              <span>
                <Check size={15} /> You stay in control
              </span>
            </div>
          </div>
          <div className="match-preview">
            <div className="preview-top">
              <div>
                <span className="eyebrow">LIVE MATCH PREVIEW</span>
                <h3>Your best offers, ranked.</h3>
              </div>
              <Gauge size={25} />
            </div>
            <div className="preview-card first">
              <div className="rank-circle">1</div>
              <div className="preview-provider">
                <strong>Best fit for your need</strong>
                <span>Within budget · Ahead of schedule</span>
              </div>
              <div className="score-ring">94%</div>
            </div>
            <div className="mini-bars">
              <ScoreBar label="Budget fit" value={98} />
              <ScoreBar label="Delivery" value={92} />
              <ScoreBar label="Relevance" value={89} />
            </div>
            <div className="preview-card muted">
              <div className="rank-circle">2</div>
              <div className="preview-provider">
                <strong>Another strong option</strong>
                <span>Compare every detail at a glance</span>
              </div>
              <div className="score-ring secondary">82%</div>
            </div>
            <div className="preview-insight">
              <Sparkles size={17} />
              <span>
                <strong>Why it ranks high</strong>
                Balanced price, fast delivery, and highly relevant experience.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="container demo-strip">
        <div>
          <span className="demo-strip-icon">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>
              {data.requirements.length
                ? "Explore NeedMatch with your current workspace"
                : "Want to see the complete matching journey?"}
            </strong>
            <span>
              {data.requirements.length
                ? "Your saved requirements, offers and services are active."
                : "Load a judge-ready scenario, then compare, negotiate and select."}
            </span>
          </div>
        </div>
        <div>
          {data.requirements.length > 0 && (
            <Button variant="ghost" onClick={clearDemo}>
              <Trash2 size={16} /> Clear data
            </Button>
          )}
          <Button variant="secondary" onClick={loadDemo}>
            <Sparkles size={16} /> Load Demo Scenario
          </Button>
        </div>
      </section>

      <section className="how-section container">
        <div className="section-heading center">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>From requirement to right match.</h2>
          <p>
            Three considered steps. No noisy directories or endless outreach.
          </p>
        </div>
        <div className="steps-grid">
          {[
            [
              Plus,
              "01",
              "Tell us what you need",
              "Add your budget, timeline, and priorities in a focused brief.",
            ],
            [
              Users,
              "02",
              "Receive tailored offers",
              "Providers respond with clear proposals built around your need.",
            ],
            [
              Target,
              "03",
              "Compare and choose",
              "Use live match scores, shortlist, negotiate, and select with confidence.",
            ],
          ].map(([Icon, number, title, copy]) => (
            <div className="step-card" key={String(number)}>
              <div className="step-number">{number as string}</div>
              <div className="step-icon">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <h3>{title as string}</h3>
              <p>{copy as string}</p>
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="container recent-section">
          <div className="section-heading row-heading">
            <div>
              <span className="eyebrow">OPEN REQUIREMENTS</span>
              <h2>Opportunities waiting for a match.</h2>
            </div>
            <Button variant="secondary" onClick={() => navigate("browse")}>
              View all <ArrowRight size={16} />
            </Button>
          </div>
          <div className="requirement-grid">
            {recent.map((item) => (
              <RequirementCard
                key={item.id}
                requirement={item}
                offerCount={
                  data.offers.filter((offer) => offer.requirementId === item.id)
                    .length
                }
                onClick={() => openRequirement(item.id)}
              />
            ))}
          </div>
        </section>
      )}
      <section className="home-cta container">
        <div>
          <span className="eyebrow">READY WHEN YOU ARE</span>
          <h2>The right offer could be one post away.</h2>
        </div>
        <Button onClick={() => navigate("post")}>
          Post your first requirement <ArrowRight size={17} />
        </Button>
      </section>
    </>
  )
}

function PostRequirement({
  onSubmit,
}: {
  onSubmit: (requirement: Requirement) => void
}) {
  const [tags, setTags] = useState("")
  const [form, setForm] = useState({
    title: "",
    category: "Design",
    description: "",
    budgetMin: "",
    budgetMax: "",
    deadline: "",
    urgency: "Medium" as Urgency,
  })
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      id: uid(),
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      budgetMin: Number(form.budgetMin),
      budgetMax: Number(form.budgetMax),
      deadline: form.deadline,
      urgency: form.urgency,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: "Open",
      createdAt: new Date().toISOString(),
    })
  }
  const invalid =
    !form.title ||
    !form.description ||
    !form.deadline ||
    !form.budgetMin ||
    !form.budgetMax ||
    Number(form.budgetMax) < Number(form.budgetMin)
  return (
    <div className="container page-wrap narrow">
      <div className="page-heading">
        <Badge tone="neutral">
          <Plus size={13} /> NEW REQUIREMENT
        </Badge>
        <h1>What do you need?</h1>
        <p>
          A thoughtful brief attracts thoughtful offers. You can review
          everything before choosing.
        </p>
      </div>
      <form className="form-card" onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h3>The essentials</h3>
              <p>Give providers a clear picture of the outcome.</p>
            </div>
          </div>
          <Field label="Requirement title">
            <input
              required
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="e.g. Need a custom logo + brand kit"
            />
          </Field>
          <div className="form-grid">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="Urgency">
              <select
                value={form.urgency}
                onChange={(event) => update("urgency", event.target.value)}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </Field>
          </div>
          <Field
            label="Description"
            hint={`${form.description.length}/800 characters`}
          >
            <textarea
              required
              maxLength={800}
              rows={6}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Describe the work, expected deliverables, and what a great result looks like..."
            />
          </Field>
        </div>
        <div className="form-section">
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h3>Budget and timing</h3>
              <p>Set realistic boundaries for more useful matches.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Minimum budget">
              <div className="input-icon">
                <IndianRupee size={16} />
                <input
                  required
                  min="1"
                  type="number"
                  value={form.budgetMin}
                  onChange={(event) => update("budgetMin", event.target.value)}
                  placeholder="3,000"
                />
              </div>
            </Field>
            <Field label="Maximum budget">
              <div className="input-icon">
                <IndianRupee size={16} />
                <input
                  required
                  min="1"
                  type="number"
                  value={form.budgetMax}
                  onChange={(event) => update("budgetMax", event.target.value)}
                  placeholder="5,000"
                />
              </div>
            </Field>
          </div>
          <Field label="Deadline">
            <input
              required
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={form.deadline}
              onChange={(event) => update("deadline", event.target.value)}
            />
          </Field>
          <Field label="Tags" hint="Separate tags with commas">
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="minimal, logo, brand kit, source files"
            />
          </Field>
        </div>
        <div className="form-submit">
          <div>
            <ShieldCheck size={19} />
            <span>Your requirement is saved securely in this browser.</span>
          </div>
          <Button type="submit" disabled={invalid}>
            Publish requirement <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </div>
  )
}

function BrowsePage({
  data,
  openRequirement,
  navigate,
  openListing,
  loadDemo,
}: {
  data: Data
  openRequirement: (id: string) => void
  navigate: (page: Page) => void
  openListing: (mode: "create" | "edit" | "view", listingId?: string) => void
  loadDemo: () => void
}) {
  const [tab, setTab] = useState<"requirements" | "services">("requirements")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [sort, setSort] = useState("Newest")
  const visible = useMemo(() => {
    const filtered = data.requirements.filter(
      (item) =>
        item.status !== "Closed" &&
        (category === "All" || item.category === category) &&
        `${item.title} ${item.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    return filtered.sort((a, b) =>
      sort === "Budget high"
        ? b.budgetMax - a.budgetMax
        : sort === "Deadline"
          ? a.deadline.localeCompare(b.deadline)
          : b.createdAt.localeCompare(a.createdAt),
    )
  }, [data.requirements, query, category, sort])
  const visibleListings = data.listings.filter(
    (item) =>
      item.status === "Published" &&
      (category === "All" || item.category === category) &&
      `${item.name} ${item.description} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  return (
    <div className="container page-wrap">
      <div className="page-heading split">
        <div>
          <span className="eyebrow">OPEN MARKETPLACE</span>
          <h1>
            {tab === "requirements"
              ? "Find a need you can solve."
              : "Discover services ready to help."}
          </h1>
          <p>
            People post what they need. Providers showcase what they can
            deliver. NeedMatch brings both sides together.
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="secondary"
            onClick={() => openListing("create")}
          >
            <Store size={17} /> List Your Service
          </Button>
          <Button onClick={() => navigate("post")}>
            <Plus size={17} /> Post a requirement
          </Button>
        </div>
      </div>
      <div className="market-tabs">
        <button
          className={tab === "requirements" ? "active" : ""}
          onClick={() => setTab("requirements")}
        >
          <BriefcaseBusiness size={17} /> Requirements
          <span>{data.requirements.filter((item) => item.status !== "Closed").length}</span>
        </button>
        <button
          className={tab === "services" ? "active" : ""}
          onClick={() => setTab("services")}
        >
          <Store size={17} /> Provider Services
          <span>{data.listings.filter((item) => item.status === "Published").length}</span>
        </button>
      </div>
      <div className="filters">
        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "requirements"
                ? "Search requirements..."
                : "Search provider services..."
            }
          />
        </div>
        <div className="select-box">
          <Filter size={16} />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option>All</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="select-box">
          <SlidersHorizontal size={16} />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option>Newest</option>
            <option>Budget high</option>
            <option>Deadline</option>
          </select>
        </div>
      </div>
      {tab === "requirements" && visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title={
            data.requirements.length
              ? "No requirements match"
              : "No requirements yet"
          }
          copy={
            data.requirements.length
              ? "Try broadening your search or changing the category."
              : "Post what you need and let providers compete with relevant offers."
          }
          action={
            !data.requirements.length ? (
              <div className="empty-actions">
                <Button onClick={() => navigate("post")}>
                  <Plus size={17} /> Post a Requirement
                </Button>
                <Button variant="secondary" onClick={loadDemo}>
                  <Sparkles size={16} /> Try Demo Data
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : tab === "requirements" ? (
        <>
          <div className="results-meta">
            <span>
              {visible.length} open requirement{visible.length === 1 ? "" : "s"}
            </span>
            <span>Updated live</span>
          </div>
          <div className="requirement-grid">
            {visible.map((item) => (
              <RequirementCard
                key={item.id}
                requirement={item}
                offerCount={
                  data.offers.filter((offer) => offer.requirementId === item.id)
                    .length
                }
                onClick={() => openRequirement(item.id)}
              />
            ))}
          </div>
        </>
      ) : visibleListings.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No services listed yet"
          copy="Showcase what you provide and let customers discover you."
          action={
            <div className="empty-actions">
              <Button onClick={() => openListing("create")}>
                <Plus size={17} /> Add Your Service
              </Button>
              {!data.requirements.length && (
                <Button variant="secondary" onClick={loadDemo}>
                  <Sparkles size={16} /> Try Demo Data
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          <div className="results-meta">
            <span>
              {visibleListings.length} available service
              {visibleListings.length === 1 ? "" : "s"}
            </span>
            <span>Provider listings</span>
          </div>
          <div className="listing-grid">
            {visibleListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onView={() => openListing("view", listing.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ListingCard({
  listing,
  onView,
  actions,
}: {
  listing: Listing
  onView: () => void
  actions?: ReactNode
}) {
  return (
    <article className="listing-card">
      <div className="listing-image">
        {listing.image ? (
          <img src={listing.image} alt="" />
        ) : (
          <div>
            <Image size={29} strokeWidth={1.4} />
            <span>{listing.category}</span>
          </div>
        )}
        <Badge tone={listing.status === "Published" ? "success" : "warning"}>
          {listing.status}
        </Badge>
      </div>
      <div className="listing-card-body">
        <div className="card-topline">
          <Badge tone="neutral">{listing.category}</Badge>
          <span className="availability">{listing.availability}</span>
        </div>
        <h3>{listing.name}</h3>
        <p className="clamp">{listing.description}</p>
        <div className="tag-row">
          {listing.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="listing-terms">
          <div>
            <span>Starting at</span>
            <strong>{money(listing.startingPrice)}</strong>
          </div>
          <div>
            <span>Delivery</span>
            <strong>{listing.deliveryDays} days</strong>
          </div>
        </div>
        {actions ?? (
          <Button variant="secondary" className="full" onClick={onView}>
            <Eye size={16} /> View service
          </Button>
        )}
      </div>
    </article>
  )
}

function RequirementCard({
  requirement,
  offerCount,
  onClick,
}: {
  requirement: Requirement
  offerCount: number
  onClick: () => void
}) {
  return (
    <article className="requirement-card" onClick={onClick}>
      <div className="card-topline">
        <Badge tone="neutral">{requirement.category}</Badge>
        <StatusBadge status={requirement.status} />
      </div>
      <h3>{requirement.title}</h3>
      <p className="clamp">{requirement.description}</p>
      <div className="card-detail-row">
        <span>
          <WalletCards size={16} /> {money(requirement.budgetMin)}–
          {money(requirement.budgetMax)}
        </span>
        <span>
          <Clock3 size={16} /> {daysUntil(requirement.deadline)} days left
        </span>
      </div>
      <div className="card-footer">
        <span>
          <MessageCircle size={16} /> {offerCount} offer
          {offerCount === 1 ? "" : "s"}
        </span>
        <span className="text-link">
          View requirement <ArrowRight size={15} />
        </span>
      </div>
    </article>
  )
}

function RequirementDetail({
  data,
  requirementId,
  setData,
  notify,
  navigate,
  openNegotiation,
}: {
  data: Data
  requirementId?: string
  setData: React.Dispatch<React.SetStateAction<Data>>
  notify: (message: string) => void
  navigate: (page: Page) => void
  openNegotiation: (requirementId: string, offerId: string) => void
}) {
  const requirement = data.requirements.find(
    (item) => item.id === requirementId,
  )
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [adjustedMax, setAdjustedMax] = useState(requirement?.budgetMax ?? 0)
  const [sort, setSort] = useState<"Match Score" | "Price" | "Delivery Time">(
    "Match Score",
  )

  useEffect(
    () => setAdjustedMax(requirement?.budgetMax ?? 0),
    [requirement?.id, requirement?.budgetMax],
  )

  if (!requirement)
    return (
      <div className="container page-wrap">
        <EmptyState
          icon={BriefcaseBusiness}
          title="No requirement selected"
          copy="Choose an open requirement to view its offers and matching details."
          action={
            <Button onClick={() => navigate("browse")}>
              Browse requirements
            </Button>
          }
        />
      </div>
    )

  const related = data.offers.filter(
    (offer) => offer.requirementId === requirement.id,
  )
  const ranked = related
    .map((offer) => ({
      offer,
      score: scoreOffer(requirement, offer, adjustedMax),
    }))
    .sort((a, b) =>
      sort === "Price"
        ? a.offer.price - b.offer.price
        : sort === "Delivery Time"
          ? a.offer.deliveryDays - b.offer.deliveryDays
          : b.score.overall - a.score.overall,
    )
  const sliderMin = Math.max(100, Math.round(requirement.budgetMin * 0.6))
  const sliderMax = Math.max(requirement.budgetMax * 2, sliderMin + 100)

  const shortlist = (offerId: string) => {
    setData((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.id === requirement.id && item.status !== "Selected"
          ? { ...item, status: "Shortlisting" }
          : item,
      ),
      offers: current.offers.map((offer) =>
        offer.id === offerId
          ? { ...offer, shortlisted: !offer.shortlisted }
          : offer,
      ),
    }))
    const offer = related.find((item) => item.id === offerId)
    notify(
      offer?.shortlisted
        ? "Offer removed from shortlist"
        : "Offer added to shortlist",
    )
  }
  const selectOffer = (offerId: string) => {
    setData((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.id === requirement.id
          ? { ...item, status: "Selected", selectedOfferId: offerId }
          : item,
      ),
      offers: current.offers.map((offer) =>
        offer.requirementId === requirement.id
          ? {
              ...offer,
              status: offer.id === offerId ? "Selected" : "Not selected",
            }
          : offer,
      ),
    }))
    notify("Offer selected — the match is confirmed")
  }
  const closeRequirement = () => {
    setData((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.id === requirement.id ? { ...item, status: "Closed" } : item,
      ),
    }))
    notify("Requirement closed")
  }

  return (
    <div className="container page-wrap">
      <button className="back-link" onClick={() => navigate("browse")}>
        <ArrowRight size={16} className="rotate" /> Back to requirements
      </button>
      <div className="detail-header">
        <div>
          <div className="detail-badges">
            <Badge tone="neutral">{requirement.category}</Badge>
            <StatusBadge status={requirement.status} />
            {requirement.urgency === "High" && (
              <Badge tone="warning">High urgency</Badge>
            )}
          </div>
          <h1>{requirement.title}</h1>
          <p>{requirement.description}</p>
          <div className="tag-row">
            {requirement.tags.map((tag) => (
              <span key={tag}>
                <Tag size={13} /> {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="detail-summary">
          <div>
            <span>Budget</span>
            <strong>
              {money(requirement.budgetMin)}–{money(requirement.budgetMax)}
            </strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>
              {new Date(`${requirement.deadline}T00:00:00`).toLocaleDateString(
                "en-IN",
                { day: "numeric", month: "short", year: "numeric" },
              )}
            </strong>
          </div>
          <div>
            <span>Offers</span>
            <strong>{related.length}</strong>
          </div>
        </div>
      </div>

      <div className="action-strip">
        <div>
          <strong>Have the right experience?</strong>
          <span>Submit a clear offer tailored to this requirement.</span>
        </div>
        <div>
          {related.length > 1 && (
            <Button variant="secondary" onClick={() => navigate("compare")}>
              <BarChart3 size={17} /> Compare offers
            </Button>
          )}
          {requirement.status !== "Closed" &&
            requirement.status !== "Selected" && (
              <Button onClick={() => setShowOfferForm(!showOfferForm)}>
                <Plus size={17} /> Submit an offer
              </Button>
            )}
          {requirement.status === "Selected" && (
            <Button variant="secondary" onClick={closeRequirement}>
              <CheckCircle2 size={17} /> Mark completed
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showOfferForm && (
          <OfferForm
            requirement={requirement}
            onCancel={() => setShowOfferForm(false)}
            onSubmit={(offer) => {
              setData((current) => ({
                ...current,
                requirements: current.requirements.map((item) =>
                  item.id === requirement.id && item.status === "Open"
                    ? { ...item, status: "Receiving Offers" }
                    : item,
                ),
                offers: [offer, ...current.offers],
              }))
              setShowOfferForm(false)
              notify("Offer submitted and scored instantly")
            }}
          />
        )}
      </AnimatePresence>

      {related.length > 0 && (
        <section className="budget-lab">
          <div className="budget-lab-copy">
            <div className="lab-icon">
              <SlidersHorizontal size={21} />
            </div>
            <div>
              <span className="eyebrow">WHAT-IF BUDGET ADJUSTER</span>
              <h3>See how your budget changes the ranking</h3>
              <p>
                Drag the maximum budget. Scores and positions update instantly
                without changing your original brief.
              </p>
            </div>
          </div>
          <div className="slider-panel">
            <div className="slider-value">
              <span>Adjusted maximum</span>
              <strong>{money(adjustedMax)}</strong>
            </div>
            <input
              className="range"
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={100}
              value={adjustedMax}
              onChange={(event) => setAdjustedMax(Number(event.target.value))}
            />
            <div className="slider-labels">
              <span>{money(sliderMin)}</span>
              <span>{money(sliderMax)}</span>
            </div>
          </div>
        </section>
      )}

      <section className="offers-section">
        <div className="section-heading row-heading compact">
          <div>
            <span className="eyebrow">LIVE RANKING</span>
            <h2>Offers matched to your need</h2>
          </div>
          {related.length > 0 && (
            <div className="select-box">
              <SlidersHorizontal size={16} />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option>Match Score</option>
                <option>Price</option>
                <option>Delivery Time</option>
              </select>
            </div>
          )}
        </div>
        {ranked.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No offers yet"
            copy="This requirement is live and ready to receive its first tailored offer."
            action={
              requirement.status !== "Closed" ? (
                <Button onClick={() => setShowOfferForm(true)}>
                  <Plus size={17} /> Submit the first offer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="offers-list">
            {ranked.map(({ offer, score }, index) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                requirement={requirement}
                score={score}
                rank={index + 1}
                isBest={sort === "Match Score" && index === 0}
                onShortlist={() => shortlist(offer.id)}
                onNegotiate={() => openNegotiation(requirement.id, offer.id)}
                onSelect={() => selectOffer(offer.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function OfferForm({
  requirement,
  onCancel,
  onSubmit,
}: {
  requirement: Requirement
  onCancel: () => void
  onSubmit: (offer: Offer) => void
}) {
  const [form, setForm] = useState({
    providerName: "",
    price: "",
    deliveryDays: "",
    message: "",
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const seed = form.providerName
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0)
    onSubmit({
      id: uid(),
      requirementId: requirement.id,
      providerName: form.providerName.trim(),
      price: Number(form.price),
      deliveryDays: Number(form.deliveryDays),
      message: form.message.trim(),
      shortlisted: false,
      status: "Active",
      createdAt: new Date().toISOString(),
      providerStats: {
        completion: 84 + (seed % 16),
        onTime: 80 + (seed % 19),
        response: 86 + (seed % 14),
        jobs: 8 + (seed % 73),
      },
    })
  }
  return (
    <motion.form
      className="offer-form"
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="form-section-title">
        <span>
          <Send size={17} />
        </span>
        <div>
          <h3>Submit your offer</h3>
          <p>Your match score will be calculated as soon as you submit.</p>
        </div>
      </div>
      <div className="form-grid three">
        <Field label="Provider name">
          <input
            required
            value={form.providerName}
            onChange={(event) =>
              setForm({ ...form, providerName: event.target.value })
            }
            placeholder="Your name or studio"
          />
        </Field>
        <Field label="Your price">
          <div className="input-icon">
            <IndianRupee size={16} />
            <input
              required
              min="1"
              type="number"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
              placeholder="4,200"
            />
          </div>
        </Field>
        <Field label="Delivery time (days)">
          <input
            required
            min="1"
            type="number"
            value={form.deliveryDays}
            onChange={(event) =>
              setForm({ ...form, deliveryDays: event.target.value })
            }
            placeholder="3"
          />
        </Field>
      </div>
      <Field label="Message">
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(event) =>
            setForm({ ...form, message: event.target.value })
          }
          placeholder="Explain your approach, relevant experience, and what is included..."
        />
      </Field>
      <div className="offer-form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            !form.providerName ||
            !form.price ||
            !form.deliveryDays ||
            !form.message
          }
        >
          Submit offer <ArrowRight size={17} />
        </Button>
      </div>
    </motion.form>
  )
}

function OfferCard({
  offer,
  requirement,
  score,
  rank,
  isBest,
  onShortlist,
  onNegotiate,
  onSelect,
}: {
  offer: Offer
  requirement: Requirement
  score: Score
  rank: number
  isBest: boolean
  onShortlist: () => void
  onNegotiate: () => void
  onSelect: () => void
}) {
  const under = Math.round(
    ((requirement.budgetMax - offer.price) / requirement.budgetMax) * 100,
  )
  const early = daysUntil(requirement.deadline) - offer.deliveryDays
  const reason =
    offer.rankExplanation ??
    (offer.price <= requirement.budgetMax && early >= 0
      ? `Ranked #${rank} because it is ${Math.abs(under)}% ${
          under >= 0 ? "under" : "over"
        } budget and delivers ${early || "right on time"}${
          early ? ` day${early === 1 ? "" : "s"} early` : ""
        }.`
      : offer.price > requirement.budgetMax
        ? `Ranked #${rank}: strong relevance, but the price is ${Math.abs(under)}% above your current budget.`
        : `Ranked #${rank}: excellent budget fit, with delivery ${Math.abs(early)} day${
            Math.abs(early) === 1 ? "" : "s"
          } after the target.`)
  return (
    <motion.article className={cn("offer-card", isBest && "best")} layout>
      <div className="offer-main">
        <div className="offer-head">
          <div className="provider">
            <div className="avatar">
              {offer.providerName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="provider-name">
                <h3>{offer.providerName}</h3>
                <Badge tone="success">
                  <ShieldCheck size={13} /> {trustScore(offer)} Trust
                </Badge>
              </div>
              <span>{offer.providerStats.jobs} completed projects</span>
            </div>
          </div>
          <div className="offer-badges">
            {isBest && (
              <Badge tone="dark">
                <Star size={13} /> Best Match
              </Badge>
            )}
            {offer.status === "Selected" && (
              <Badge tone="success">Selected</Badge>
            )}
          </div>
        </div>
        <p className="offer-message">“{offer.message}”</p>
        <div className="offer-terms">
          <div>
            <span>Offer price</span>
            <strong>{money(offer.price)}</strong>
          </div>
          <div>
            <span>Delivery</span>
            <strong>{offer.deliveryDays} days</strong>
          </div>
          <div>
            <span>Response</span>
            <strong>{offer.providerStats.response}%</strong>
          </div>
        </div>
        <div className="why-ranked">
          <Sparkles size={17} />
          <span>
            <strong>Why this ranked high</strong>
            {reason}
          </span>
        </div>
      </div>
      <div className="score-panel">
        <div
          className={cn(
            "big-score",
            score.overall >= 85
              ? "good"
              : score.overall >= 65
                ? "average"
                : "poor",
          )}
        >
          <motion.strong
            key={score.overall}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
          >
            {score.overall}%
          </motion.strong>
          <span>Match score</span>
        </div>
        <div className="score-bars">
          <ScoreBar label="Budget fit" value={score.budget} />
          <ScoreBar label="Delivery speed" value={score.delivery} />
          <ScoreBar label="Relevance" value={score.relevance} />
        </div>
        <div className="offer-actions">
          <Button
            variant={offer.shortlisted ? "primary" : "secondary"}
            onClick={onShortlist}
          >
            <Heart
              size={16}
              fill={offer.shortlisted ? "currentColor" : "none"}
            />
            {offer.shortlisted ? "Shortlisted" : "Shortlist"}
          </Button>
          {offer.shortlisted && offer.status !== "Selected" && (
            <Button variant="secondary" onClick={onNegotiate}>
              <MessageCircle size={16} /> Negotiate
            </Button>
          )}
          {requirement.status !== "Closed" && offer.status !== "Selected" && (
            <Button onClick={onSelect}>
              <Check size={16} /> Select offer
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 85 ? "green" : value >= 60 ? "amber" : "red"
  return (
    <div className="score-bar">
      <div>
        <span>{label}</span>
        <strong className={tone}>{value}%</strong>
      </div>
      <div className="bar-track">
        <motion.span
          className={tone}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.45 }}
        />
      </div>
    </div>
  )
}

function Comparison({
  data,
  requirementId,
  setData,
  notify,
  openNegotiation,
}: {
  data: Data
  requirementId?: string
  setData: React.Dispatch<React.SetStateAction<Data>>
  notify: (message: string) => void
  openNegotiation: (requirementId: string, offerId: string) => void
}) {
  const [chosenId, setChosenId] = useState(
    requirementId ??
      data.requirements.find((item) =>
        data.offers.some((offer) => offer.requirementId === item.id),
      )?.id,
  )
  const requirement = data.requirements.find((item) => item.id === chosenId)
  const offers = requirement
    ? data.offers
        .filter((offer) => offer.requirementId === requirement.id)
        .map((offer) => ({ offer, score: scoreOffer(requirement, offer) }))
        .sort((a, b) => b.score.overall - a.score.overall)
    : []
  if (!requirement || !offers.length)
    return (
      <div className="container page-wrap">
        <EmptyState
          icon={BarChart3}
          title="Nothing to compare yet"
          copy="Submit at least one offer to unlock side-by-side comparison."
        />
      </div>
    )
  const select = (offerId: string) => {
    setData((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.id === requirement.id
          ? { ...item, status: "Selected", selectedOfferId: offerId }
          : item,
      ),
      offers: current.offers.map((offer) =>
        offer.requirementId === requirement.id
          ? {
              ...offer,
              status: offer.id === offerId ? "Selected" : "Not selected",
            }
          : offer,
      ),
    }))
    notify("Best-fit offer selected")
  }
  return (
    <div className="container page-wrap">
      <div className="page-heading split">
        <div>
          <span className="eyebrow">COMPARISON DASHBOARD</span>
          <h1>Choose with the full picture.</h1>
          <p>Compare every meaningful signal side by side.</p>
        </div>
        <div className="select-box">
          <BriefcaseBusiness size={16} />
          <select
            value={chosenId}
            onChange={(event) => setChosenId(event.target.value)}
          >
            {data.requirements
              .filter((item) =>
                data.offers.some((offer) => offer.requirementId === item.id),
              )
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="compare-context">
        <span>Comparing {offers.length} offers for</span>
        <strong>{requirement.title}</strong>
      </div>
      <div
        className="comparison-grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(offers.length, 4)}, minmax(260px, 1fr))`,
        }}
      >
        {offers.slice(0, 4).map(({ offer, score }, index) => (
          <article
            className={cn("compare-card", index === 0 && "winner")}
            key={offer.id}
          >
            {index === 0 && (
              <div className="winner-label">
                <Star size={13} /> Best overall match
              </div>
            )}
            <div className="avatar large">
              {offer.providerName.slice(0, 2).toUpperCase()}
            </div>
            <h3>{offer.providerName}</h3>
            <Badge tone="success">
              <ShieldCheck size={13} /> {trustScore(offer)} Trust
            </Badge>
            <div className="compare-score">{score.overall}%</div>
            <span className="compare-score-label">Compatibility score</span>
            <div className="compare-terms">
              <div>
                <span>Price</span>
                <strong>{money(offer.price)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{offer.deliveryDays} days</strong>
              </div>
            </div>
            <div className="score-bars">
              <ScoreBar label="Budget fit" value={score.budget} />
              <ScoreBar label="Delivery" value={score.delivery} />
              <ScoreBar label="Relevance" value={score.relevance} />
            </div>
            <div className="compare-actions">
              <Button className="full" onClick={() => select(offer.id)}>
                Select this offer
              </Button>
              <Button
                variant="secondary"
                className="full"
                onClick={() => openNegotiation(requirement.id, offer.id)}
              >
                Negotiate
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function MyRequirements({
  data,
  openRequirement,
  navigate,
}: {
  data: Data
  openRequirement: (id: string) => void
  navigate: (page: Page) => void
}) {
  return (
    <div className="container page-wrap">
      <div className="page-heading split">
        <div>
          <span className="eyebrow">REQUESTER VIEW</span>
          <h1>My requirements</h1>
          <p>Track every brief from first offer through final selection.</p>
        </div>
        <Button onClick={() => navigate("post")}>
          <Plus size={17} /> New requirement
        </Button>
      </div>
      {data.requirements.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Your requirement list is empty"
          copy="Start with a clear brief. Offers, scores, and negotiations will appear here."
          action={
            <Button onClick={() => navigate("post")}>Post a requirement</Button>
          }
        />
      ) : (
        <div className="list-card">
          {data.requirements.map((item) => {
            const offers = data.offers.filter(
              (offer) => offer.requirementId === item.id,
            )
            const best = offers.length
              ? Math.max(
                  ...offers.map((offer) => scoreOffer(item, offer).overall),
                )
              : 0
            return (
              <button
                className="requirement-row"
                key={item.id}
                onClick={() => openRequirement(item.id)}
              >
                <div className="row-main">
                  <span className="category-icon">
                    {item.category.slice(0, 1)}
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <span>
                      {item.category} · Posted{" "}
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
                <div className="row-stat">
                  <span>Offers</span>
                  <strong>{offers.length}</strong>
                </div>
                <div className="row-stat">
                  <span>Best match</span>
                  <strong>{best ? `${best}%` : "—"}</strong>
                </div>
                <StatusBadge status={item.status} />
                <ArrowRight size={17} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MyOffers({
  data,
  setData,
  notify,
  openRequirement,
  navigate,
  openNegotiation,
}: {
  data: Data
  setData: React.Dispatch<React.SetStateAction<Data>>
  notify: (message: string) => void
  openRequirement: (id: string) => void
  navigate: (page: Page) => void
  openNegotiation: (requirementId: string, offerId: string) => void
}) {
  const [filter, setFilter] = useState<
    "All" | "Active" | "Shortlisted" | "Negotiation" | "Selected" | "Closed"
  >("All")
  const [editing, setEditing] = useState<string>()
  const [draft, setDraft] = useState({ price: "", days: "" })
  const filtered = data.offers.filter((offer) => {
    const requirement = data.requirements.find(
      (item) => item.id === offer.requirementId,
    )
    if (filter === "All") return true
    if (filter === "Shortlisted") return offer.shortlisted
    if (filter === "Negotiation") return offer.status === "Negotiating"
    if (filter === "Selected") return offer.status === "Selected"
    if (filter === "Closed") return requirement?.status === "Closed"
    return offer.status === "Active" && !offer.shortlisted
  })
  const offerLabel = (offer: Offer, requirement: Requirement) =>
    requirement.status === "Closed"
      ? "Closed"
      : offer.status === "Negotiating"
        ? "Under Negotiation"
        : offer.status === "Selected"
          ? "Selected"
          : offer.shortlisted
            ? "Shortlisted"
            : "Active"
  return (
    <div className="container page-wrap">
      <div className="page-heading split">
        <div>
          <span className="eyebrow">PROVIDER VIEW</span>
          <h1>My offers</h1>
          <p>See your submitted proposals and how each one matches.</p>
        </div>
        <Button onClick={() => navigate("browse")}>
          <Search size={17} /> Find requirements
        </Button>
      </div>
      {data.offers.length > 0 && (
        <div className="filter-pills">
          {[
            "All",
            "Active",
            "Shortlisted",
            "Negotiation",
            "Selected",
            "Closed",
          ].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item as typeof filter)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {data.offers.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="You haven’t submitted an offer yet"
          copy="Browse open requirements and respond where your experience is a strong fit."
          action={
            <Button onClick={() => navigate("browse")}>
              Browse opportunities
            </Button>
          }
        />
      ) : (
        <div className="provider-offers">
          {filtered.map((offer) => {
            const requirement = data.requirements.find(
              (item) => item.id === offer.requirementId,
            )
            if (!requirement) return null
            const score = scoreOffer(requirement, offer)
            return (
              <article className="provider-offer-card" key={offer.id}>
                <div className="provider-offer-main">
                  <div>
                    <Badge tone="neutral">{requirement.category}</Badge>
                    <h3>{requirement.title}</h3>
                    <span>Submitted as {offer.providerName}</span>
                  </div>
                  <Badge
                    tone={
                      offer.status === "Selected"
                        ? "success"
                        : offer.status === "Negotiating" || offer.shortlisted
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {offerLabel(offer, requirement)}
                  </Badge>
                </div>
                <div className="provider-offer-metrics">
                  <div>
                    <span>Your offer</span>
                    <strong>{money(offer.price)}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>{offer.deliveryDays} days</strong>
                  </div>
                  <div
                    className={cn(
                      "small-score",
                      score.overall >= 85
                        ? "good"
                        : score.overall >= 65
                          ? "average"
                          : "poor",
                    )}
                  >
                    <span>Match score</span>
                    <strong>{score.overall}%</strong>
                  </div>
                </div>
                {editing === offer.id && (
                  <div className="inline-edit">
                    <Field label="Offer price">
                      <input
                        type="number"
                        value={draft.price}
                        onChange={(event) =>
                          setDraft({ ...draft, price: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Delivery days">
                      <input
                        type="number"
                        value={draft.days}
                        onChange={(event) =>
                          setDraft({ ...draft, days: event.target.value })
                        }
                      />
                    </Field>
                    <Button
                      onClick={() => {
                        setData((current) => ({
                          ...current,
                          offers: current.offers.map((item) =>
                            item.id === offer.id
                              ? {
                                  ...item,
                                  price: Number(draft.price),
                                  deliveryDays: Number(draft.days),
                                  demoScore: undefined,
                                }
                              : item,
                          ),
                        }))
                        setEditing(undefined)
                        notify("Offer updated and match score recalculated")
                      }}
                    >
                      Save changes
                    </Button>
                  </div>
                )}
                <div className="provider-offer-actions">
                  <Button
                    variant="secondary"
                    onClick={() => openRequirement(requirement.id)}
                  >
                    <Eye size={16} /> View Requirement
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(editing === offer.id ? undefined : offer.id)
                      setDraft({
                        price: offer.price.toString(),
                        days: offer.deliveryDays.toString(),
                      })
                    }}
                  >
                    <Pencil size={16} /> Edit Offer
                  </Button>
                  {(offer.shortlisted ||
                    offer.status === "Negotiating" ||
                    offer.status === "Selected") && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        openNegotiation(requirement.id, offer.id)
                      }
                    >
                      <MessageCircle size={16} /> Negotiation
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
          {filtered.length === 0 && (
            <EmptyState
              icon={Filter}
              title={`No ${filter.toLowerCase()} offers`}
              copy="Offers matching this status will appear here."
            />
          )}
        </div>
      )}
    </div>
  )
}

function Workspace({
  data,
  openRequirement,
  navigate,
  openListing,
  setData,
  notify,
  loadDemo,
  clearDemo,
}: {
  data: Data
  openRequirement: (id: string) => void
  navigate: (page: Page) => void
  openListing: (mode: "create" | "edit" | "view", listingId?: string) => void
  setData: React.Dispatch<React.SetStateAction<Data>>
  notify: (message: string) => void
  loadDemo: () => void
  clearDemo: () => void
}) {
  const allScores = data.offers.flatMap((offer) => {
    const requirement = data.requirements.find(
      (item) => item.id === offer.requirementId,
    )
    return requirement ? [scoreOffer(requirement, offer).overall] : []
  })
  const selected = data.requirements.filter((item) => item.selectedOfferId)
  const saved = selected.reduce((sum, requirement) => {
    const offer = data.offers.find(
      (item) => item.id === requirement.selectedOfferId,
    )
    return sum + (offer ? Math.max(0, requirement.budgetMax - offer.price) : 0)
  }, 0)
  const stats = [
    [
      BriefcaseBusiness,
      "Total requirements",
      data.requirements.length.toString(),
      "All briefs created",
    ],
    [
      Gauge,
      "Average match score",
      allScores.length
        ? `${Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)}%`
        : "—",
      "Across all offers",
    ],
    [
      CheckCircle2,
      "Successful matches",
      selected.length.toString(),
      "Offers selected",
    ],
    [TrendingUp, "Money saved", money(saved), "Against max budgets"],
  ] as const
  return (
    <div className="container page-wrap">
      <div className="page-heading split">
        <div>
          <span className="eyebrow">YOUR NEEDMATCH WORKSPACE</span>
          <h1>Everything you need, in one calm place.</h1>
          <p>
            Manage your requirements and showcase the services you provide.
          </p>
        </div>
        <div className="heading-actions">
          {data.requirements.length > 0 && (
            <Button variant="ghost" onClick={clearDemo}>
              <Trash2 size={16} /> Clear data
            </Button>
          )}
          <Button variant="secondary" onClick={loadDemo}>
            <Sparkles size={16} /> Try Demo Data
          </Button>
          <Button onClick={() => openListing("create")}>
            <Plus size={17} /> Add New Listing
          </Button>
        </div>
      </div>
      <section className="workspace-section">
        <div className="section-heading row-heading compact">
          <div>
            <span className="eyebrow">PROVIDER PROFILE</span>
            <h2>My Listings</h2>
            <p>Services customers can discover throughout the marketplace.</p>
          </div>
          <Button onClick={() => openListing("create")}>
            <Plus size={17} /> Add New Listing
          </Button>
        </div>
        {data.listings.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No services listed yet"
            copy="Showcase what you provide and let customers discover you."
            action={
              <Button onClick={() => openListing("create")}>
                <Plus size={17} /> Add Your Service
              </Button>
            }
          />
        ) : (
          <div className="listing-grid">
            {data.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onView={() => openListing("view", listing.id)}
                actions={
                  <div className="listing-actions">
                    <Button
                      variant="secondary"
                      onClick={() => openListing("edit", listing.id)}
                    >
                      <Pencil size={15} /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => openListing("view", listing.id)}
                    >
                      <Eye size={15} /> View
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setData((current) => ({
                          ...current,
                          listings: current.listings.map((item) =>
                            item.id === listing.id
                              ? {
                                  ...item,
                                  status:
                                    item.status === "Published"
                                      ? "Paused"
                                      : "Published",
                                }
                              : item,
                          ),
                        }))
                        notify(
                          listing.status === "Published"
                            ? "Listing paused"
                            : "Listing published",
                        )
                      }}
                    >
                      {listing.status === "Published" ? (
                        <Pause size={15} />
                      ) : (
                        <Play size={15} />
                      )}
                      {listing.status === "Published" ? "Pause" : "Resume"}
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
      <div className="workspace-divider" />
      <div className="stats-grid">
        {stats.map(([Icon, label, value, copy]) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon">
              <Icon size={21} />
            </div>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{copy}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h3>Recent requirements</h3>
              <p>Your latest marketplace activity</p>
            </div>
            {data.requirements.length > 0 && (
              <Button variant="ghost" onClick={() => navigate("requirements")}>
                View all
              </Button>
            )}
          </div>
          {data.requirements.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No activity yet"
              copy="Your newly posted requirements will appear here."
              action={
                <Button onClick={() => navigate("post")}>Get started</Button>
              }
            />
          ) : (
            <div className="mini-list">
              {data.requirements.slice(0, 5).map((item) => (
                <button key={item.id} onClick={() => openRequirement(item.id)}>
                  <span className="category-icon">
                    {item.category.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {
                        data.offers.filter(
                          (offer) => offer.requirementId === item.id,
                        ).length
                      }{" "}
                      offers
                    </small>
                  </span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="dashboard-panel quick-panel">
          <div className="panel-title">
            <div>
              <h3>Quick actions</h3>
              <p>Keep your marketplace moving</p>
            </div>
          </div>
          <button onClick={() => navigate("post")}>
            <span>
              <Plus size={19} />
            </span>
            <div>
              <strong>Post a new requirement</strong>
              <small>Describe what you need</small>
            </div>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate("browse")}>
            <span>
              <Search size={19} />
            </span>
            <div>
              <strong>Browse open requirements</strong>
              <small>Find work that fits</small>
            </div>
            <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate("compare")}>
            <span>
              <BarChart3 size={19} />
            </span>
            <div>
              <strong>Compare offers</strong>
              <small>Review your best matches</small>
            </div>
            <ArrowRight size={16} />
          </button>
        </aside>
      </div>
    </div>
  )
}

function Overview({
  data,
  openRequirement,
  navigate,
  loadDemo,
}: {
  data: Data
  openRequirement: (id: string) => void
  navigate: (page: Page) => void
  loadDemo: () => void
}) {
  const scores = data.offers.flatMap((offer) => {
    const requirement = data.requirements.find(
      (item) => item.id === offer.requirementId,
    )
    return requirement ? [scoreOffer(requirement, offer).overall] : []
  })
  const selected = data.requirements.filter((item) => item.selectedOfferId)
  const saved = selected.reduce((sum, requirement) => {
    const offer = data.offers.find(
      (item) => item.id === requirement.selectedOfferId,
    )
    return sum + (offer ? Math.max(0, requirement.budgetMax - offer.price) : 0)
  }, 0)
  const stats = [
    [
      BriefcaseBusiness,
      "Active Requirements",
      data.requirements
        .filter((item) => !["Closed", "Selected"].includes(item.status))
        .length.toString(),
    ],
    [MessageCircle, "Offers Received", data.offers.length.toString()],
    [Send, "Offers Submitted", data.offers.length.toString()],
    [
      Heart,
      "Shortlisted Offers",
      data.offers.filter((item) => item.shortlisted).length.toString(),
    ],
    [
      Handshake,
      "Active Negotiations",
      data.offers
        .filter((item) => item.status === "Negotiating")
        .length.toString(),
    ],
    [CheckCircle2, "Successful Matches", selected.length.toString()],
    [
      Gauge,
      "Average Match Score",
      scores.length
        ? `${Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)}%`
        : "—",
    ],
    [TrendingUp, "Money Saved", money(saved)],
  ] as const
  const firstRequirement = data.requirements[0]
  const firstOffer = firstRequirement
    ? data.offers.find(
        (item) => item.requirementId === firstRequirement.id,
      )
    : undefined
  const activities = firstRequirement
    ? [
        {
          icon: Plus,
          label: "Posted requirement",
          title: firstRequirement.title,
          meta: firstRequirement.category,
        },
        ...(firstOffer
          ? [
              {
                icon: MessageCircle,
                label: `Received offer from ${firstOffer.providerName}`,
                title: `${money(firstOffer.price)} • ${firstOffer.deliveryDays} days`,
                meta: "Offer received",
              },
              ...(firstOffer.shortlisted
                ? [
                    {
                      icon: Heart,
                      label: "Offer shortlisted",
                      title: firstOffer.providerName,
                      meta: "Shortlist updated",
                    },
                  ]
                : []),
            ]
          : []),
        ...data.offers
          .filter((item) => item.status === "Negotiating")
          .slice(0, 1)
          .map((item) => ({
            icon: Handshake,
            label: "Negotiation started",
            title: item.providerName,
            meta: "Terms in progress",
          })),
        ...data.offers
          .filter((item) => item.status === "Selected")
          .slice(0, 1)
          .map((item) => ({
            icon: CheckCircle2,
            label: "Offer selected",
            title: item.providerName,
            meta: "Successful match",
          })),
      ]
    : []
  const snapshotMax = Math.max(
    1,
    data.requirements.length,
    data.offers.length,
    selected.length,
  )
  return (
    <div className="container page-wrap">
      <div className="page-heading split">
        <div>
          <span className="eyebrow">MARKETPLACE ACTIVITY</span>
          <h1>A considered view of your momentum.</h1>
          <p>
            The useful signals from both sides of NeedMatch, without the noise
            of a traditional admin dashboard.
          </p>
        </div>
        <Button onClick={() => navigate("post")}>
          <Plus size={17} /> Post requirement
        </Button>
      </div>
      {data.requirements.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Your overview is ready for activity"
          copy="Post your first requirement or load the complete demo journey to see marketplace signals here."
          action={
            <div className="empty-actions">
              <Button onClick={() => navigate("post")}>
                Post a Requirement
              </Button>
              <Button variant="secondary" onClick={loadDemo}>
                <Sparkles size={16} /> Load Demo Scenario
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="overview-stats">
            {stats.map(([Icon, label, value]) => (
              <div className="overview-stat" key={label}>
                <Icon size={18} strokeWidth={1.6} />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="overview-grid">
            <section className="activity-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">RECENT ACTIVITY</span>
                  <h3>The marketplace in motion</h3>
                </div>
              </div>
              <div className="activity-list">
                {activities.map((activity, index) => (
                  <div className="activity-item" key={`${activity.label}-${index}`}>
                    <span className="activity-icon">
                      <activity.icon size={17} />
                    </span>
                    <div>
                      <span>{activity.label}</span>
                      <strong>{activity.title}</strong>
                      <small>{activity.meta}</small>
                    </div>
                  </div>
                ))}
              </div>
              {firstRequirement && (
                <Button
                  variant="secondary"
                  onClick={() => openRequirement(firstRequirement.id)}
                >
                  View latest requirement <ArrowRight size={16} />
                </Button>
              )}
            </section>
            <aside className="snapshot-panel">
              <span className="eyebrow">MARKETPLACE SNAPSHOT</span>
              <h3>Both sides, at a glance</h3>
              <p>Requirements create demand. Offers turn it into matches.</p>
              {[
                ["Requirements", data.requirements.length],
                ["Offers", data.offers.length],
                ["Matches", selected.length],
              ].map(([label, value]) => (
                <div className="snapshot-row" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                  <div className="snapshot-track">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(Number(value) / snapshotMax) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function ListingEditor({
  listing,
  mode,
  onCancel,
  onSave,
  onEdit,
}: {
  listing?: Listing
  mode: "create" | "edit" | "view"
  onCancel: () => void
  onSave: (listing: Listing) => void
  onEdit: () => void
}) {
  const [form, setForm] = useState({
    name: listing?.name ?? "",
    category: listing?.category ?? "Design & Branding",
    description: listing?.description ?? "",
    startingPrice: listing?.startingPrice.toString() ?? "",
    deliveryDays: listing?.deliveryDays.toString() ?? "",
    tags: listing?.tags.join(", ") ?? "",
    availability: listing?.availability ?? ("Available" as Listing["availability"]),
    image: listing?.image,
    documentName: listing?.documentName,
  })
  useEffect(() => {
    setForm({
      name: listing?.name ?? "",
      category: listing?.category ?? "Design & Branding",
      description: listing?.description ?? "",
      startingPrice: listing?.startingPrice.toString() ?? "",
      deliveryDays: listing?.deliveryDays.toString() ?? "",
      tags: listing?.tags.join(", ") ?? "",
      availability:
        listing?.availability ?? ("Available" as Listing["availability"]),
      image: listing?.image,
      documentName: listing?.documentName,
    })
  }, [listing?.id])
  const readImage = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      setForm((current) => ({ ...current, image: String(reader.result) }))
    reader.readAsDataURL(file)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave({
      id: listing?.id ?? uid(),
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      startingPrice: Number(form.startingPrice),
      deliveryDays: Number(form.deliveryDays),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      availability: form.availability,
      image: form.image,
      documentName: form.documentName,
      status: listing?.status ?? "Published",
      createdAt: listing?.createdAt ?? new Date().toISOString(),
    })
  }
  if (mode === "view" && listing)
    return (
      <div className="container page-wrap narrow">
        <button className="back-link" onClick={onCancel}>
          <ArrowRight size={16} className="rotate" /> Back to workspace
        </button>
        <div className="listing-detail">
          <div className="listing-detail-image">
            {listing.image ? (
              <img src={listing.image} alt="" />
            ) : (
              <Image size={42} strokeWidth={1.3} />
            )}
          </div>
          <div className="listing-detail-body">
            <div className="detail-badges">
              <Badge tone="neutral">{listing.category}</Badge>
              <Badge tone={listing.status === "Published" ? "success" : "warning"}>
                {listing.status}
              </Badge>
            </div>
            <h1>{listing.name}</h1>
            <p>{listing.description}</p>
            <div className="tag-row">
              {listing.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="listing-detail-terms">
              <div>
                <span>Starting price</span>
                <strong>{money(listing.startingPrice)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{listing.deliveryDays} days</strong>
              </div>
              <div>
                <span>Availability</span>
                <strong>{listing.availability}</strong>
              </div>
            </div>
            {listing.documentName && (
              <div className="document-chip">
                <FileText size={16} /> {listing.documentName}
              </div>
            )}
            <div className="heading-actions">
              <Button variant="secondary" onClick={onCancel}>
                Back to listings
              </Button>
              <Button onClick={onEdit}>
                <Pencil size={16} /> Edit listing
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  return (
    <div className="container page-wrap narrow">
      <button className="back-link" onClick={onCancel}>
        <ArrowRight size={16} className="rotate" /> Back to workspace
      </button>
      <div className="page-heading">
        <Badge tone="neutral">
          <Store size={13} /> PROVIDER LISTING
        </Badge>
        <h1>{mode === "edit" ? "Refine your service." : "What do you provide?"}</h1>
        <p>
          Create a polished service profile customers can discover in Browse.
        </p>
      </div>
      <form className="form-card" onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h3>Service presentation</h3>
              <p>Show customers what you do and who it is for.</p>
            </div>
          </div>
          <Field label="Upload image">
            <label className="upload-field">
              {form.image ? (
                <img src={form.image} alt="Listing preview" />
              ) : (
                <>
                  <Upload size={24} />
                  <strong>Choose a service image</strong>
                  <span>PNG, JPG or WEBP</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => readImage(event.target.files?.[0])}
              />
            </label>
          </Field>
          <div className="form-grid">
            <Field label="Service / Product name">
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Logo & Brand Identity Package"
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              required
              rows={6}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Describe your service, deliverables and ideal customer..."
            />
          </Field>
        </div>
        <div className="form-section">
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h3>Terms and availability</h3>
              <p>Set clear expectations for customers.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Starting price">
              <div className="input-icon">
                <IndianRupee size={16} />
                <input
                  required
                  type="number"
                  min="1"
                  value={form.startingPrice}
                  onChange={(event) =>
                    setForm({ ...form, startingPrice: event.target.value })
                  }
                  placeholder="4,000"
                />
              </div>
            </Field>
            <Field label="Delivery time (days)">
              <input
                required
                type="number"
                min="1"
                value={form.deliveryDays}
                onChange={(event) =>
                  setForm({ ...form, deliveryDays: event.target.value })
                }
                placeholder="4"
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Tags" hint="Separate with commas">
              <input
                value={form.tags}
                onChange={(event) =>
                  setForm({ ...form, tags: event.target.value })
                }
                placeholder="Logo, Branding, College Events"
              />
            </Field>
            <Field label="Availability">
              <select
                value={form.availability}
                onChange={(event) =>
                  setForm({
                    ...form,
                    availability: event.target
                      .value as Listing["availability"],
                  })
                }
              >
                <option>Available</option>
                <option>Limited availability</option>
                <option>Unavailable</option>
              </select>
            </Field>
          </div>
          <Field label="Optional portfolio / document">
            <label className="document-upload">
              <FileText size={18} />
              <span>
                {form.documentName ?? "Attach a PDF or portfolio document"}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) =>
                  setForm({
                    ...form,
                    documentName: event.target.files?.[0]?.name,
                  })
                }
              />
            </label>
          </Field>
        </div>
        <div className="form-submit">
          <div>
            <ShieldCheck size={19} />
            <span>Your listing will appear in Provider Services.</span>
          </div>
          <div className="heading-actions">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !form.name ||
                !form.description ||
                !form.startingPrice ||
                !form.deliveryDays
              }
            >
              {mode === "edit" ? "Save Changes" : "Publish Listing"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Negotiation({
  data,
  requirementId,
  offerId,
  setData,
  notify,
  navigate,
}: {
  data: Data
  requirementId?: string
  offerId?: string
  setData: React.Dispatch<React.SetStateAction<Data>>
  notify: (message: string) => void
  navigate: (page: Page) => void
}) {
  const requirement = data.requirements.find(
    (item) => item.id === requirementId,
  )
  const offer = data.offers.find((item) => item.id === offerId)
  const [sender, setSender] = useState<"Requester" | "Provider">("Requester")
  const [text, setText] = useState("")
  const [price, setPrice] = useState(offer?.price.toString() ?? "")
  const [days, setDays] = useState(offer?.deliveryDays.toString() ?? "")
  const messages = data.messages.filter(
    (item) => item.requirementId === requirementId && item.offerId === offerId,
  )
  if (!requirement || !offer)
    return (
      <div className="container page-wrap">
        <EmptyState
          icon={MessageCircle}
          title="No negotiation selected"
          copy="Shortlist an offer to open a negotiation room."
        />
      </div>
    )
  const send = (proposal = false) => {
    if (!text.trim() && !proposal) return
    const message: NegotiationMessage = {
      id: uid(),
      requirementId: requirement.id,
      offerId: offer.id,
      sender,
      text: text.trim() || `${sender} proposed revised terms.`,
      createdAt: new Date().toISOString(),
      proposal: proposal
        ? { price: Number(price), deliveryDays: Number(days) }
        : undefined,
    }
    setData((current) => ({
      ...current,
      messages: [...current.messages, message],
    }))
    setText("")
    notify(proposal ? "Revised terms proposed" : "Message sent")
  }
  const accept = (message: NegotiationMessage) => {
    if (!message.proposal) return
    setData((current) => ({
      ...current,
      messages: current.messages.map((item) =>
        item.id === message.id ? { ...item, accepted: true } : item,
      ),
      offers: current.offers.map((item) =>
        item.id === offer.id
          ? {
              ...item,
              price: message.proposal!.price,
              deliveryDays: message.proposal!.deliveryDays,
            }
          : item,
      ),
    }))
    setPrice(message.proposal.price.toString())
    setDays(message.proposal.deliveryDays.toString())
    notify("Revised offer accepted and applied")
  }
  const select = () => {
    setData((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.id === requirement.id
          ? { ...item, status: "Selected", selectedOfferId: offer.id }
          : item,
      ),
      offers: current.offers.map((item) =>
        item.requirementId === requirement.id
          ? {
              ...item,
              status: item.id === offer.id ? "Selected" : "Not selected",
            }
          : item,
      ),
    }))
    notify("Negotiation complete — offer selected")
    navigate("detail")
  }
  return (
    <div className="container page-wrap negotiation-page">
      <button className="back-link" onClick={() => navigate("detail")}>
        <ArrowRight size={16} className="rotate" /> Back to requirement
      </button>
      <div className="negotiation-layout">
        <section className="chat-panel">
          <div className="chat-header">
            <div className="provider">
              <div className="avatar">
                {offer.providerName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3>Negotiation with {offer.providerName}</h3>
                <span>
                  <i /> Live room · Terms update instantly
                </span>
              </div>
            </div>
            <Badge tone="warning">Under Negotiation</Badge>
          </div>
          <div className="chat-context">
            <strong>{requirement.title}</strong>
            <span>
              Current offer: {money(offer.price)} · {offer.deliveryDays} days
            </span>
          </div>
          <div className="messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <MessageCircle size={25} />
                <strong>Start the conversation</strong>
                <span>
                  Discuss scope or use the terms panel to make a concrete
                  proposal.
                </span>
              </div>
            )}
            {messages.map((message) => (
              <div
                className={cn(
                  "message-wrap",
                  message.sender === "Requester" && "mine",
                )}
                key={message.id}
              >
                <span className="message-sender">{message.sender}</span>
                <div className="message-bubble">
                  <p>{message.text}</p>
                  {message.proposal && (
                    <div className="proposal">
                      <div>
                        <span>Proposed price</span>
                        <strong>{money(message.proposal.price)}</strong>
                      </div>
                      <div>
                        <span>Delivery</span>
                        <strong>{message.proposal.deliveryDays} days</strong>
                      </div>
                      {message.accepted ? (
                        <Badge tone="success">
                          <Check size={13} /> Accepted
                        </Badge>
                      ) : (
                        message.sender !== sender && (
                          <Button onClick={() => accept(message)}>
                            Accept terms
                          </Button>
                        )
                      )}
                    </div>
                  )}
                  <small>
                    {new Date(message.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="chat-compose">
            <div className="role-switch">
              <span>Sending as</span>
              <button
                className={sender === "Requester" ? "active" : ""}
                onClick={() => setSender("Requester")}
              >
                Requester
              </button>
              <button
                className={sender === "Provider" ? "active" : ""}
                onClick={() => setSender("Provider")}
              >
                Provider
              </button>
            </div>
            <div className="compose-row">
              <textarea
                rows={2}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write a message or explain your counter..."
              />
              <Button onClick={() => send(false)} disabled={!text.trim()}>
                <Send size={17} />
              </Button>
            </div>
          </div>
        </section>
        <aside className="terms-panel">
          <div>
            <span className="eyebrow">REVISED TERMS</span>
            <h3>Make a proposal</h3>
            <p>Either side can propose a new price or delivery time.</p>
          </div>
          <Field label="Proposed price">
            <div className="input-icon">
              <IndianRupee size={16} />
              <input
                type="number"
                min="1"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Delivery time (days)">
            <input
              type="number"
              min="1"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </Field>
          <Button
            className="full"
            onClick={() => send(true)}
            disabled={!price || !days}
          >
            Send proposal <Send size={16} />
          </Button>
          <div className="terms-divider" />
          <div className="current-score">
            <span>Updated match score</span>
            <strong>
              {
                scoreOffer(requirement, {
                  ...offer,
                  price: Number(price) || offer.price,
                  deliveryDays: Number(days) || offer.deliveryDays,
                }).overall
              }
              %
            </strong>
          </div>
          <p className="terms-note">
            The score previews how these proposed terms fit the original
            requirement.
          </p>
          <Button variant="secondary" className="full" onClick={select}>
            <CheckCircle2 size={16} /> Select final offer
          </Button>
        </aside>
      </div>
    </div>
  )
}

export default App
