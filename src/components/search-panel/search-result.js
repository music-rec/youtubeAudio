import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { decodeHtmlEntities } from '../../utils';

const SearchResult = ({ item, onPlayClicked, onEnqueueClicked, loading }) => {
    const playClickListener = useCallback((e) => {
        e.preventDefault();
        onPlayClicked(item);
    }, [item, onPlayClicked]);

    const enqueueClickListener = useCallback((e) => {
        e.preventDefault();
        onEnqueueClicked(item);
    }, [item, onEnqueueClicked]);

    return (
        <div className="row mb-1 result">
            <div className="col-auto">
                {item.snippet.thumbnails &&
                    <img
                        src={(item.snippet.thumbnails.medium || item.snippet.thumbnails.default).url}
                        alt="Video thumbnail"
                        width={128}
                        onClick={() => onPlayClicked(item)}
                    />
                }
            </div>
            <div className="col row">
                <div className="col-12 align-self-start">
                    <small>{decodeHtmlEntities(item.snippet.title)}</small>
                </div>
                <div className="col-12 align-self-end">
                    {item.id.kind === 'youtube#video' && <button className="btn btn-link" onClick={playClickListener} disabled={loading}>
                        <i className="material-icons">play_circle_outline</i>
                    </button>}
                    <button className="btn btn-link" onClick={enqueueClickListener} disabled={loading}>
                        <i className="material-icons">playlist_add</i>
                    </button>
                </div>
            </div>
        </div>
    );
};

SearchResult.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.shape({
            kind: PropTypes.string.isRequired,
            videoId: PropTypes.string,
            playlistId: PropTypes.string,
        }).isRequired,
    }).isRequired,
    onPlayClicked: PropTypes.func.isRequired,
    onEnqueueClicked: PropTypes.func.isRequired,
    loading: PropTypes.bool,
};

SearchResult.defaultProps = {
    loading: false,
};

export default SearchResult;
