// ========== ACCOUNT BASE (shared across every page except home.html) ==========
// home.html already wires this directly into script.js. Every other page
// only loads its own page script (checklist.js, goals.js, etc.), which
// knows nothing about the account-pill or quote rotator — this file is the
// one thing that needs to be added to a page's script list to get both,
// without touching that page's burger/sidebar code (IDs differ per page).

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();

    // Site-wide plan flag — drives the gold navbar pill and the
    // [data-plan="account"] styling in styles.css. Works the same for a
    // guest (user is null, isSignedIn() resolves false) as for an account.
    let signedIn = false;
    if (window.isSignedIn) {
        signedIn = await isSignedIn();
        document.documentElement.setAttribute("data-plan", signedIn ? "account" : "guest");
    }

    // The rotating carousel is a signed-in touch; guests get the plain
    // static quote (one quote, no animation) like before.
    if (signedIn) {
        startQuoteRotator();
    } else {
        renderStaticQuote();
    }
});

const DEFAULT_QUOTES = [
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Will Durant" },
  { text: "Whether you think you can, or you think you can't — you're right.", author: "Henry Ford" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "The successful warrior is the average man with laser-like focus.", author: "Bruce Lee" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },

  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Small disciplines repeated with consistency every day lead to great achievements.", author: "John C. Maxwell" },
  { text: "You will never change your life until you change something you do daily.", author: "John C. Maxwell" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },

  { text: "Do not wait to strike till the iron is hot, but make it hot by striking.", author: "William Butler Yeats" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "What we fear doing most is usually what we most need to do.", author: "Tim Ferriss" },
  { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle (attributed)" },
  { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },

  { text: "You become what you think about.", author: "Earl Nightingale" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Without continual growth and progress, such words as improvement, achievement, and success have no meaning.", author: "Benjamin Franklin" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
  { text: "Never confuse movement with action.", author: "Ernest Hemingway" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "If you spend too much time thinking about a thing, you'll never get it done.", author: "Bruce Lee" },

  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
  { text: "Fall seven times and stand up eight.", author: "Japanese Proverb" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "Suffer the pain of discipline or suffer the pain of regret.", author: "Jim Rohn" },
  { text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },

  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "If opportunity doesn't knock, build a door.", author: "Milton Berle" },
  { text: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy (attributed)" },
  { text: "You are what you do, not what you say you'll do.", author: "Carl Jung (attributed)" }
];

function startQuoteRotator(quotes = DEFAULT_QUOTES, intervalMs = 2000) {
    const wrap = document.getElementById("quote-rotator");
    const textEl = document.getElementById("quote-text");
    const authorEl = document.getElementById("quote-author");
    if (!wrap || !textEl || !authorEl || quotes.length === 0) return;

    let i = 0;
    const render = () => {
        textEl.textContent = `\u201C${quotes[i].text}\u201D`;
        authorEl.textContent = `\u2014 ${quotes[i].author}`;
    };
    render();

    setInterval(() => {
        wrap.classList.add("quote-out");
        setTimeout(() => {
            i = (i + 1) % quotes.length;
            render();
            wrap.classList.remove("quote-out");
        }, 350);
    }, intervalMs);
}

// Guest version: one quote, no rotation, no interval — the "normal"
// quote system, picked by the day so it still changes daily without
// the signed-in carousel animation.
function renderStaticQuote(quotes = DEFAULT_QUOTES) {
    const textEl = document.getElementById("quote-text");
    const authorEl = document.getElementById("quote-author");
    if (!textEl || !authorEl || quotes.length === 0) return;

    const dayIndex = Math.floor(Date.now() / 86400000) % quotes.length;
    const q = quotes[dayIndex];
    textEl.textContent = `\u201C${q.text}\u201D`;
    authorEl.textContent = `\u2014 ${q.author}`;
}