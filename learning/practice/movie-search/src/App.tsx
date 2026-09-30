import { useState, useEffect } from 'react'
import { useDebounce } from 'react-use';
import './App.css'
import Search from './components/Search'
import MovieCard from './components/MovieCard'

const API_BASE_URL = 'https://api.themoviedb.org/3';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const API_OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`
  }
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');


  useDebounce(() => setDebouncedSearchTerm(searchTerm), 750, [searchTerm])

  const fetchMovies = async (query = '') => {

    setLoading(true);
    try {
      const endpoint = query
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;

      const response = await fetch(endpoint, API_OPTIONS);

      if (!response.ok) {
        throw new Error('Failed to fetch movies');
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error('No movies found');
      }
      setMovies(data.results);

      setLoading(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Failed to fetch movies');
      setLoading(false);
    }

  }

  useEffect(() => {
    fetchMovies(debouncedSearchTerm);
  }, [debouncedSearchTerm]);


  return (
    <main>
      <div className="pattern" />
      <div className="wrapper">
        <header>
          <h1>Movie Search</h1>

          <Search
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        </header>

        <section className="all-movies">
          <h2>All Movies</h2>
          <ul>
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
              />
            ))}
          </ul>
        </section>

      </div>
      {errorMessage && <p className="error">{errorMessage}</p>}

    </main>
  );
}

export default App
