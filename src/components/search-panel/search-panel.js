import React, { useState, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTransition, animated } from 'react-spring';
import Pagination from './pagination';
import SearchResult from './search-result';
import { searchVideos } from '../../api';
import { useAudioPlayer } from '../../hooks/audio-player';
import { useEnqueuePlaylist, useEnqueueSong } from '../../hooks/enqueue';
import '../../styles/SearchPanel/SearchPanel.scss';

const SearchPanel = ({ showing }) => {
    const transitions = useTransition(showing, null, {
        from: { transform: `translateX(${SearchPanel._right}px)` },
        enter: { transform: 'translateX(0)' },
        leave: { transform: `translateX(${SearchPanel._right}px)` },
    });
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [page, setPage] = useState(0);
    const search = useRef(null);
    const enqueuePlaylist = useEnqueuePlaylist();
    const enqueueSong = useEnqueueSong();
    const audioPlayer = useAudioPlayer();

    const searchFieldChanged = useCallback((event) => {
        event.preventDefault();
        setText(event.target.value);
    }, []);

    const searchFieldDoSearch = useCallback(async (event) => {
        if(event.keyCode === 13) {
            event.preventDefault();
            setLoading(true);
            setPage(0);
            setResults([]);
            search.current = searchVideos(text);
            const results = [await search.current.getNextPage()];
            setLoading(false);
            setResults(results);
        }
    }, [text]);

    const prevPage = useCallback(async (event) => {
        event.preventDefault();
        setPage((currentPage) => Math.max(currentPage - 1, 0));
    }, []);

    const nextPage = useCallback(async (event) => {
        event.preventDefault();
        if(page + 1 === search.current.loadedPages) {
            setLoading(true);
            const newResults = await search.current.getNextPage();
            setLoading(false);
            setResults((results) => [...results, newResults]);
            setPage((page) => page + 1);
        } else {
            setPage((page) => Math.min(page + 1, search.current.totalPages - 1));
        }
    }, [page]);

    const paginationElement = useMemo(() => (
        results.length > 0 && (
            <Pagination
                page={page}
                nextPage={nextPage}
                prevPage={prevPage}
                totalPages={search.current.totalPages - 1}
            />
        )
    ), [results, page, nextPage, prevPage]);

    const onEnqueueClicked = useCallback(
        ({ id: { kind, playlistId, videoId }, snippet: { title } }) => (
            kind === 'youtube#playlist' ? enqueuePlaylist(playlistId, title) : enqueueSong(videoId, title)
        ),
        [enqueuePlaylist, enqueueSong],
    );

    const onPlayClicked = useCallback(({ id: { kind, playlistId, videoId }, snippet: { title } }) => (
        kind === 'youtube#playlist' ? enqueuePlaylist(playlistId, title, true) : enqueueSong(videoId, title, true)
    ), [enqueuePlaylist, enqueueSong]);

    return transitions.map(({ item, key, props }) => item && (
        <animated.div id="searchPanel" style={props} key={key}>
            <div className="mt-4 ml-4 mr-4">
                <div className="form-group">
                    <label htmlFor="search-input">Search for videos</label>
                    <input
                        id="search-input"
                        className="form-control"
                        placeholder="Search"
                        disabled={loading}
                        value={text}
                        onKeyUp={searchFieldDoSearch}
                        onChange={searchFieldChanged} />
                </div>
                <div className="container">
                    {paginationElement}
                    {results.length > 0 && results[page].map((item, i) => (
                        <SearchResult
                            key={i}
                            item={item}
                            onPlayClicked={onPlayClicked}
                            onEnqueueClicked={onEnqueueClicked}
                            loading={loading || audioPlayer.loading}
                        />
                    ))}
                    {paginationElement}
                </div>
            </div>
        </animated.div>
    ));
};

SearchPanel.propTypes = {
    showing: PropTypes.bool.isRequired,
};

Object.defineProperty(SearchPanel, '_right', {
    get: () => {
        const windowWidth = window.document.body.clientWidth;
        if(windowWidth < 576) {
            return windowWidth * 0.90;
        } else if(windowWidth < 768) {
            return 288;
        } else if(windowWidth < 1200) {
            return 384;
        } else {
            return 400;
        }
    },
});

export default SearchPanel;
