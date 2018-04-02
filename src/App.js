import React, { Component } from 'react';
import $ from 'jquery';
import 'bootstrap/dist/css/bootstrap.css';
import 'material-design-icons/iconfont/material-icons.css';
import './App.css';
import github from './github.svg';
import PlayQueue from './PlayQueue';
import keys from './keys.json';
import PlayQueueList from './PlayQueueList';
// import AdBlockDetect from 'react-ad-block-detect';

const { GOOGLE_API_KEY } = keys;

class App extends Component {
    constructor (props) {
        super(props);
        this.state = ({
            youtubeVideoURL: "",
            qualityFromAudio: 0,
            invalidURL: false,
            youtubeAudioURL: "",
            youtubeVideoTitle: "",
            loading: false,
            error: false,
            errorMessage: "",
            nightMode: true,
            currentFormat: "",
            youtubeVideoID: "",
            showingQueue: false,
            youtubePlaylistID: "",
            compatibility: this.checkFormats(),
            playQueue: new PlayQueue()
        });
        this.audioRef = React.createRef();
        this.listenerTestButton = this.listenerTestButton.bind(this);
        this.nightModeListener = this.nightModeListener.bind(this);
        this.titleProgress = this.titleProgress.bind(this);
        this.listenerForm = this.listenerForm.bind(this);
        this.addToQueue = this.addToQueue.bind(this);
        this.showQueue = this.showQueue.bind(this);
        this.playSong = this.playSong.bind(this);
        this.clear = this.clear.bind(this);
    }

    _testYoutubeVideoURL = "https://www.youtube.com/watch?v=bM7SZ5SBzyY";

    clear(){
        this.setState({playQueue: this.state.playQueue.emptyQueue(), error: false, errorMessage: ""});
    }

    addToQueue(){
        let newState = { error: false, errorMessage: "" };
        if(this.state.youtubeVideoID) {
            newState.loading = true;
            $.ajax({
                async: true,
                type: "GET",
                url: "https://yt-audio-api.herokuapp.com/api/" + this.state.youtubeVideoID,
                success: (response) => {
                    this.setState({
                        loading: false,
                        playQueue: this.state.playQueue.add({
                            id: this.state.youtubeVideoID,
                            title: response.title
                        })
                    }, () => {
                        if (this.state.playQueue.values.length > 0){
                            this.selectBestOption(this.state.youtubeVideoID);
                        }
                    });
                },
                error: () => this.setState({ loading: false, error: true, errorMessage: "Video not found..." })
            });
        } else if(this.state.youtubePlaylistID) {
            newState.loading = true;
            this.addYoutubePlaylist();
        }
        this.setState(newState);
    }

    playSong(){
        this.setState({
            error: false,
            errorMessage: "",
            playQueue: !this.state.youtubeVideoID ? this.state.playQueue : this.state.playQueue.addFirst({
                id: this.state.youtubeVideoID,
                title: null
            })
        });
        if (this.state.youtubeVideoID) {
            this.selectBestOption(this.state.youtubeVideoID);
        } else if(this.state.youtubePlaylistID) {
            this.addYoutubePlaylist(true);
        }
    }

    addYoutubePlaylist(startPlaying = false, nextId = null) {
        this.setState({ loading: true });
        let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=id,snippet&maxResults=50&playlistId=${this.state.youtubePlaylistID}&key=${GOOGLE_API_KEY}`;
        if(nextId) url += `&pageToken=${nextId}`;
        $.ajax({
            url,
            async: true,
            type: 'GET',
            success: response => {
                this.setState({
                    loading: !!response.nextToken,
                    playQueue: this.state.playQueue.add(...response.items.map(item => ({ id: item.snippet.resourceId.videoId, title: item.snippet.title })))
                }, () => {
                    if(this.state.playQueue.values.length > 0) {
                        this.setState({
                            youtubeVideoID: this.state.playQueue.values[0].id,
                            youtubeVideoTitle: this.state.playQueue.values[0].title
                        });
                        this.selectBestOption(this.state.playQueue.values[0].id, startPlaying);
                    }
                });
                if(response.nextPageToken) {
                    this.addYoutubePlaylist(startPlaying, response.nextPageToken);
                }
            },
            error: () => this.setState({ loading: false, error: true, errorMessage: "Cannot load videos from playlist..." })
        })
    }

    checkFormats(){
        let a = document.createElement("audio");
        return ({
            opus: ((a.canPlayType("audio/webm; codecs=opus")) !== ""),
            vorbis: ((a.canPlayType("audio/webm; codecs=vorbis")) !== ""),
            m4a: ((a.canPlayType("audio/x-m4a; codecs=mp4a.40.2")) !== "")
        });
    }

    listenerTestButton(event){
        event.preventDefault();
        this.setState({youtubeVideoURL: this._testYoutubeVideoURL});
        this.selectBestOption(this.getYoutubeVideoID(this._testYoutubeVideoURL));
    }

    listenerForm(event) {
        let url = event.target.value.trim();
        let newState = {youtubeVideoURL: url};
        let youtubeVideoID = this.getYoutubeVideoID(url);
        let youtubePlaylistID = this.getPlaylistID(url);
        if (youtubeVideoID !== null){
            newState.invalidURL = false;
            newState.youtubeVideoID = youtubeVideoID;
        } else if(youtubePlaylistID !== null) {
            newState.invalidURL = false;
            newState.youtubePlaylistID = youtubePlaylistID;
        } else {
            newState.invalidURL = url.length !== 0;
        }
        this.setState(newState);
        $("title").text("YouTube Audio");
    }

    selectBestOption(youtubeVideoID, autoplay = false) {
        setTimeout(() => this.setState({ loading: true, error: false, errorMessage: "" }));
        $.ajax({
            async: true,
            type: "GET",
            url: "https://yt-audio-api.herokuapp.com/api/" + youtubeVideoID + "/formats",
            success: (response) => {
                response = response
                    .filter(e => this.state.compatibility.m4a && e.container === 'm4a')
                    .concat(response.filter(e => this.state.compatibility.vorbis && e.extra.startsWith('vorbis')))
                    .concat(response.filter(e => this.state.compatibility.opus && e.extra.startsWith('opus')));
                if(response.length === 0){
                    this.setState({ error: true, errorMessage: "Not compatible sources found for your browser", loading: false });
                    return;
                }
                response.forEach(e => {
                    let bits = e.extra.split(/[\s@k]+/g);
                    e.codec = bits[0]; e.bitrate = parseInt(bits[1], 10);
                    if (e.codec !== "vorbis" && e.codec !== "opus")
                        e.codec = "m4a";
                });
                response.sort(this.predicateBy("bps", true));
                this.setState({ currentFormat: response[0].codec + "@~" + (response[0].bitrate ? response[0].bitrate : response[0].bps) + "kbps" });
                this.loadAudioURL(youtubeVideoID, response[0].id, autoplay);
            },
            error: () => this.setState({ loading: false, youtubeAudioURL: "", youtubeVideoTitle: "", error: true, errorMessage: "Video not found..." })
        });
    }

    predicateBy(prop, desc){
        return (a,b) => {
            if (a[prop] > b[prop])
                return desc ? -1 : 1;
            else if(a[prop] < b[prop])
                return desc ? 1 : -1;
            else
                 return 0;
        }
    }

    loadAudioURL(youtubeVideoID, formatID, autoplay = false) {
        $.ajax({
            async: true,
            type: "GET",
            url: "https://yt-audio-api.herokuapp.com/api/" + youtubeVideoID + "/" + formatID,
            success: (response) => {
                this.setState({youtubeAudioURL: response.url, youtubeVideoTitle: response.title, loading: false}, () => {
                    if(autoplay) {
                        this.audioRef.current.oncanplay = e => {
                            this.audioRef.current.play();
                            this.audioRef.current.oncanplay = null;
                        };
                    }
                });
                $("title").text(this.state.youtubeVideoTitle + " - YouTube Audio");
            },
            error: () => this.setState({ loading: false, youtubeAudioURL: "", youtubeVideoTitle: "", error: true, errorMessage: "Video not found..." })
        });
    }

    getYoutubeVideoID(url){
        let youtubeVideoID =
            /(?:(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\/?\?v=(.+))|(?:(?:https?:\/\/)?(?:www\.)?youtu\.be\/(.+))/
                .exec(url);
        if (youtubeVideoID !== null)
            return youtubeVideoID[1] || youtubeVideoID[2];
        else
            this.setState({loading: false});
        return null;
    }

    getPlaylistID(url) {
        let youtubePlaylistID = /playlist\?list=([A-Za-z0-9-_]+)/g.exec(url);
        if(youtubePlaylistID !== null) {
            return youtubePlaylistID[1]
        }
        return null;
    }

    nightModeListener(event){
        event.preventDefault();
        this.setState({ nightMode: !this.state.nightMode });
    }

    titleProgress(event){
        let time = Math.round(event.target.currentTime);
        let seconds = time - (Math.floor(time/60)*60);
        time = Math.floor(time/60) + ":" + (seconds < 10 ? "0"+seconds : seconds);
        $("title").text(time + " - " + this.state.youtubeVideoTitle + " - YouTube Audio");
    }

    onSongEnd(event) {
        this.setState({ playQueue: this.state.playQueue.deleteFirst() }, () => {
            if (this.state.playQueue.values.length > 0) {
                this.selectBestOption(this.state.playQueue.values[0].id, true);
            }
        });
    }

    showQueue(event) {
        event.preventDefault();
        this.setState({showingQueue: !this.state.showingQueue});
    }

    render() {
        const { youtubeVideoURL, invalidURL, youtubeVideoTitle, youtubeAudioURL, loading, error, errorMessage, nightMode,
            showingQueue, currentFormat } = this.state;
        if(nightMode) $('body').addClass('AppDark').removeClass('AppLight');
        else $('body').removeClass('AppDark').addClass('AppLight');
        return (
            <div className={`${nightMode ? 'AppDark' : 'AppLight'}`} id="AppContainer">
                <header className="App-header" id="AppHeader">
                    <h1 className="App-title">YouTube Audio Player</h1>
                    <button className="btn btn-sm btn-outline-light float-right onoffmode" id="changeSkinButton" onClick={ this.nightModeListener }>
                        { !nightMode ? <i className="material-icons">brightness_2</i> : <i className="material-icons">wb_sunny</i>}
                    </button>
                </header>
                <div className="container-fluid">
                    <PlayQueueList showing={ showingQueue } playQueue={ this.state.playQueue }/>
                    <p className="greyText" id="greyText">
                        Enjoy the audio from the youtube videos!</p>
                    <div className="d-flex row justify-content-center align-items-center" id="audioQuery">
                        <div className="col-md-6 col-sm-12">
                        {/*
                        ----
                        Disabled until bug confirm
                        ----
                        <AdBlockDetect>
                        <div className="alert alert-danger" role="alert">
                          Please, consider disabling Ad-Block in order to make the website work properly
                        </div>
                        </AdBlockDetect>
                        */}
                            <div className="input-group" id="input">
                                <div className="input-group-prepend">
                                    <input type="button" className={`btn btn-outline-${nightMode ? 'light' : 'dark'}`}
                                           id="test" name="test" value="TEST" onClick={ this.listenerTestButton }
                                           disabled={loading}/>
                                </div>
                                <input type="text" className={`form-control ${invalidURL ? 'is-invalid' : ''}`}
                                       id="videoURL" name="videoURL" onChange={ this.listenerForm }
                                       value={ youtubeVideoURL } placeholder="insert here your youtube video url..."
                                       disabled={loading}/>
                            </div>
                            <div className="row justify-content-center">
                                <div className="btn-group mt-3">
                                    <input type="button" className={`btn btn-outline-${nightMode ? 'light' : 'dark'}`}
                                           id="test" name="Play Song" value="Play Now!" onClick={ this.playSong }
                                           disabled={loading}/>
                                    <input type="button" className={`btn btn-outline-${nightMode ? 'light' : 'dark'}`}
                                           id="test" name="Add to Queue" value="Enqueue" onClick={ this.addToQueue }
                                           disabled={loading}/>
                                    <input type="button" className={`btn btn-outline-${nightMode ? 'light' : 'dark'}`}
                                           id="test" name="Clear queueue" value="Clear Queue" onClick={ this.clear }
                                           disabled={loading}/>
                                </div>
                            </div>
                            { loading ?
                                <div className="row justify-content-center">
                                    <div className="title loading" id="stateText">
                                        Loading...
                                    </div>
                                    <div className="loader"/>
                                </div>
                                    : null
                            }
                            { error ?
                                <button className="title error" id="stateText">
                                    { errorMessage }
                                </button> : null
                            }
                            { this.state.youtubeVideoTitle ?
                                <div className="title" id="stateText">
                                    <div id="NowPlaying">
                                        Now Playing: ({ currentFormat })
                                    </div>
                                    <div id="title" className="text-center"> { youtubeVideoTitle } </div>
                                </div> : null
                            }
                            { this.state.youtubeAudioURL ?
                                <audio id="player" className="player" controls src={ youtubeAudioURL }
                                       onTimeUpdate={ this.titleProgress } ref={this.audioRef} onEnded={ this.onSongEnd.bind(this) } /> : null
                            }
                        </div>
                    </div>
                    <button id="playQueue" className={`btn btn-outline-${nightMode ? 'light' : 'dark'}
                            ${showingQueue ? 'right' : 'left'}`}
                            onClick={ this.showQueue }>
                        <div id="arrow" className={`${showingQueue ? 'right' : 'left'}`}/>
                    </button>
                </div>
                <footer className="App-footer footer" id="AppFooter">
                    <div className="App-footer row" id="FooterContent">
                        <a href="https://github.com/RaulWhite/youtubeAudio" target="_blank" rel="noopener noreferrer"
                            className="col-4">
                            <img alt="GitHub" src={github} id="githubLogo" className={!nightMode ? "githubDay" : null}/>
                            &nbsp;GitHub repository
                        </a>
                        <div className="App-footer col-4" id="FooterContent">
                            Uses <a href="https://github.com/melchor629/youtubedl-audio-api"
                                    target="_blank" rel="noopener noreferrer">YoutubeDL audio API</a>
                        </div>
                        <div className="App-footer col-4" id="FooterContent">
                            Made by:&nbsp;
                            <a href="https://github.com/raulwhite" target="_blank" rel="noopener noreferrer">
                                Raul White
                            </a>,&nbsp;
                            <a href="http://alkesst.github.io" target="_blank" rel="noopener noreferrer">
                                Alkesst
                            </a>&nbsp;&amp;&nbsp;
                            <a href="http://melchor9000.me" target="_blank" rel="noopener noreferrer">
                                Melchor9000
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        );
    }
}
export default App;
