# Product Specification: Movie & TV Tracker (Foundation First)

## 📌 1. Project Overview
A personalized, ad-free, and highly responsive web application to track movies and TV shows. The immediate goal is to build a rock-solid, traditional watchlisting site (similar to Letterboxd/Trakt). Once the core mechanics (Search -> View -> Save -> Track) are flawless, the platform will be supercharged with AI integrations.

## 🛠 2. Tech Stack
*   **Frontend framework:** Next.js (React)
*   **Backend framework:** Next.js API Routes (Serverless)
*   **Database:** MongoDB Atlas (via Mongoose ORM)
*   **Media Data:** TMDB API (The Movie Database)
*   **Authentication:** NextAuth.js (or Clerk)
*   **Styling:** Tailwind CSS
*   **Future AI:** Google Gemini API (Fallback: OpenRouter free models)

---

## 🏗 3. Phase 1: The Core Foundation (MVP)

### Feature 1: Media Discovery (TMDB)
*   **Global Search:** A search bar querying TMDB's `multi-search` endpoint for movies and TV shows.
*   **Trending Dashboard:** A homepage displaying currently popular/trending media.
*   **Detailed View:** A dedicated page for a specific movie/show displaying:
    *   Poster & Backdrop
    *   Title, Release Year, Runtime, Genres
    *   Synopsis / Overview
    *   Cast & Crew
    *   Trailer link

### Feature 2: User Accounts & Authentication
*   Secure login system so individual users have private databases.
*   OAuth integration (Google/GitHub) or standard Email/Password.

### Feature 3: Watchlist Mechanics (CRUD)
*   **Create:** A modal to add a media item to the watchlist. Users can input:
    *   Status (Plan to Watch, Watching, Completed, Dropped)
    *   Rating (1-10)
    *   Text Review
*   **Read:** Fetching data from MongoDB to populate the user's private library.
*   **Update:** Changing status (e.g., moving a show from "Watching" to "Completed").
*   **Delete:** Removing an item entirely from the database.

### Feature 4: The Personal Library (Dashboard)
*   A visually appealing grid view of saved posters.
*   **Filters:** Isolate by "Movie" or "TV", and by Status (e.g., "Plan to Watch").
*   **Sorting:** Order by "Date Added", "Highest Rated", or "Release Year".

---

## 🗄 4. Database Schema Strategy (MongoDB)
To ensure the user's dashboard loads instantly without spamming TMDB for data, we will cache essential display data in our database alongside the user's review data.

### WatchlistItem Schema
```javascript
{
  userId: ObjectId,        // Links to the specific user account
  tmdbId: Number,          // TMDB's unique identifier (e.g., 157336)
  mediaType: String,       // 'movie' or 'tv'
  title: String,           // Cached from TMDB for fast loading
  posterPath: String,      // Cached TMDB image URL
  status: String,          // 'Plan to Watch', 'Watching', 'Completed', 'Dropped'
  rating: Number,          // 1-10 (Optional)
  review: String,          // User's personal thoughts (Optional)
  dateAdded: Date          // Timestamp for sorting
}
```

---

## 🚀 5. Phase 2: The AI Supercharger (Future Scope)
*Only to be started once Phase 1 is 100% bug-free and deployed.*

*   **Vibe Search:** Search the library using natural language (e.g., "Cozy snowy mystery").
*   **Taste Profiling ("Roast & Toast"):** AI analyzes 5-star ratings to generate a psychological taste profile.
*   **Auto-Tagging:** AI reads the user's review and automatically generates sortable tags (`#Tearjerker`, `#SlowBurn`).
*   **Smart Recommendations:** Hyper-specific suggestions based on recent watches and current mood.
