import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import web3 from './web3';
import lottery from './lottery';

class App extends Component {
    state = {
        president: '',
        players: [],
        balance: '',
        value: '',
        message: '',
        currentAccount: '',
        currentAccountBalance: '',
        currentAccountWonItems: [],
        lotteryState: '',
        bids: [0, 0, 0]
    };

    async componentDidMount() {
        // Set up event listeners only once
        if (!this.eventListenersSet) {
            this.setupEventListeners();
            this.eventListenersSet = true;
        }
    
        try {
            const currentAccount = (await window.ethereum.request({ method: 'eth_requestAccounts' }))[0];
            const balance = await web3.eth.getBalance(lottery.options.address);
            const currentAccountbalanceWei = await web3.eth.getBalance(currentAccount);
            const currentAccountBalance = web3.utils.fromWei(currentAccountbalanceWei, 'ether');
            this.setState({ message: '', currentAccount, currentAccountBalance, balance });
        } catch (error) {
            this.setState({ message: "Failed to load current account." });
        }

        try {
            const president = await lottery.methods.president().call();
            this.setState({ message: '', president: president.toLowerCase() });
        } catch (error) {
            this.setState({ message: "Failed to load president." });
        }

        try {
            const bids = [
                parseInt(await lottery.methods.getAmountOfBidders(0).call()), 
                parseInt(await lottery.methods.getAmountOfBidders(1).call()), 
                parseInt(await lottery.methods.getAmountOfBidders(2).call())
            ];

            this.setState({ bids });
        } catch (error) {
            this.setState({ message: "Failed to load current bids." });
        }
        
        try {
            const lotteryState = await lottery.methods.state().call();

            this.setState({ lotteryState });
        } catch (error) {
            this.setState({ message: "Failed to load lottery State." });
        }
    }

    setupEventListeners() {
        lottery.events.BidPlaced()
            .on('data', async event => {
                // Update the bids array based on the emitted event
                const itemId = event.returnValues.itemId;
                let newBids = [...this.state.bids];
                newBids[itemId] += 1;
                this.setState({ bids: newBids });
    
                // Update the current account balance
                try {
                    const currentAccountBalanceWei = await web3.eth.getBalance(this.state.currentAccount);
                    const currentAccountBalance = web3.utils.fromWei(currentAccountBalanceWei, 'ether');
                    this.setState({ currentAccountBalance });
                } catch (error) {
                    console.error('Failed to update current account balance:', error);
                }
    
                // Update the contract balance
                try {
                    const balance = await web3.eth.getBalance(lottery.options.address);
                    this.setState({ balance });
                } catch (error) {
                    console.error('Failed to update contract balance:', error);
                }
            })
            .on('error', error => {
                console.error('Error with BidPlaced event:', error);
            });

        lottery.events.StateChanged()
            .on('data', async event => {
                // Update the bids array based on the emitted event
                const newState = event.returnValues.newState;
                
                this.setState({ lotteryState: newState });
            })
            .on('error', error => {
                console.error('Error with StateChanged event:', error);
            });
    
        // Listen for changes in the connected accounts
        window.ethereum.on('accountsChanged', async (accounts) => {
            const currentAccount = accounts[0];
            this.setState({ currentAccount });
    
            // Update the current account balance when the account changes
            try {
                const currentAccountBalanceWei = await web3.eth.getBalance(currentAccount);
                const currentAccountBalance = web3.utils.fromWei(currentAccountBalanceWei, 'ether');
                this.setState({ currentAccountBalance });
            } catch (error) {
                console.error('Failed to update current account balance:', error);
            }
        });
    }    

    onBid = async (event, itemId) => {
        event.preventDefault();
        this.setState({ message: 'Waiting on transaction success...' });

        await lottery.methods.bid(itemId).send({
            from: this.state.currentAccount,
            value: web3.utils.toWei("0.01", 'ether')
        });

        this.setState({ message: 'You have placed your bid!' });
    };

    onPickWinner = async () => {
        this.setState({ message: 'Waiting on transaction success...' });

        await lottery.methods.revealWinners().send({
            from: this.state.currentAccount
        });

        this.setState({ message: 'A winner has been picked!' });
    };

    onWithdraw = async () => {
        this.setState({ message: 'Waiting on transaction success...' });

        await lottery.methods.withdraw().send({
            from: this.state.currentAccount
        });

        this.setState({ message: 'Funds have been withdrawn! Ez rug.' });
    };

    onReset = async () => {
        this.setState({ message: 'Waiting on transaction success...' });

        await lottery.methods.resetContract().send({
            from: this.state.currentAccount
        });

        this.state.bids = [0, 0, 0];

        this.setState({ message: 'Contract has been reset.' });
    };

    onCheckWinner = async () => {
        this.setState({ message: 'Waiting for response...' });
    
        try {
            const result = await lottery.methods.checkWinner().call({ from: this.state.currentAccount });
            console.log(result);
            this.setState({ currentAccountWonItems: result, message: 'Successfully got won items.' });
        } catch (error) {
            console.error('Error checking winner:', error);
            this.setState({ message: 'Error checking winner. Please try again.' });
        }
    };

    render() {
        // Replace the placeholder image URLs with actual URLs
        const imageUrls = [
            'https://img.freepik.com/premium-photo/car-isolated-white-background-tesla-model-s-electric-sedan-white-car-blank-clean-white-black_655090-605222.jpg',
            'https://assets.kotsovolos.gr/product/291089-b.jpg',
            'https://www.staples-3p.com/s7/is/image/Staples/E3F8AC59-1524-4378-B859D3DE8943B06E_sc7?wid=512&hei=512'
        ];

        return (
            <div className="container">

                <div className="row header">
                    <h2>Lottery - Ballot</h2>
                </div>

                <hr />

                {/* Three card components */}
                <div className="row">
                    {['Tesla Model S', 'Ipon 15 Pro Max', 'Lenovo Thinkpad'].map((itemName, index) => (
                        <div className="col-md-4" key={index}>
                            <div className="card">
                                <img src={imageUrls[index]} className="card-img-top" alt={itemName} />
                                <div className="card-body">
                                    <h3 className="card-title">{itemName}</h3>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <button
                                            className="btn btn-primary mr-2"
                                            onClick={(event) => this.onBid(event, index)}
                                            disabled={this.state.lotteryState === '1' || this.state.currentAccount === this.state.president}
                                        >
                                            Bid
                                        </button>                                       
                                        <span className="amntOfBidders">{this.state.bids[index]}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
    
                <hr />
                
                <div className="row justify-content-lg-between justify-content-center">
                    <div className="col-md-auto">
                        <div class="card w-auto h-auto">
                            <div className="card-body">
                                <h5>Connected as</h5>
                                <p>{this.state.currentAccount}</p>
                                <h5>Current Balance</h5>
                                <p>{parseFloat(this.state.currentAccountBalance).toFixed(4)} ETH</p>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-auto">
                        <div className="card w-auto h-auto">
                            <div className="card-body">
                                <h5>Contract Owner</h5>
                                <p>{this.state.president}</p>
                                <h5>Contract Balance</h5>
                                <div className="">
                                    <p>{web3.utils.fromWei(this.state.balance, 'ether')} ETH</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary" onClick={this.onPickWinner} disabled={this.state.lotteryState === '1' || this.state.currentAccount !== this.state.president}>
                    Declare Winners
                </button>
                <button className="btn btn-warning" onClick={this.onCheckWinner} disabled={this.state.lotteryState !== '1' || this.state.currentAccount === this.state.president}>
                    Am I Winner?
                </button>
                <button className="btn btn-primary" onClick={this.onWithdraw} disabled={this.state.currentAccount !== this.state.president}>
                    Withdraw
                </button>
                <button className="btn btn-danger" onClick={this.onReset} disabled={this.state.currentAccount !== this.state.president}>
                    Reset
                </button>
                <hr />
            </div>
        );
    }
}

export default App;
