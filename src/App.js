import React, { Component } from 'react';
import Notification from './Notification';
import 'bootstrap/dist/css/bootstrap.css';
import web3 from './web3';
import lottery from './lottery';

class App extends Component {
    state = {
        president: '',
        profAcc: '',
        newOwner: '',
        players: [],
        balance: '',
        value: '',
        notifications: [],
        currentAccount: '',
        currentAccountBalance: '',
        currentAccountWonItems: [],
        lotteryState: '',
        bids: [0, 0, 0]
    }

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
            this.setState({ currentAccount, currentAccountBalance, balance });
        } catch (error) {
            console.error("Failed to load current account:", error);
        }

        try {
            const president = await lottery.methods.president().call();
            const profAcc = await lottery.methods.profAcc().call();
            this.setState({ president: president.toLowerCase(), profAcc: profAcc.toLowerCase() });
        } catch (error) {
            console.error("Failed to load president:", error);
        }

        try {
            const bids = [
                parseInt(await lottery.methods.getAmountOfBidders(0).call()), 
                parseInt(await lottery.methods.getAmountOfBidders(1).call()), 
                parseInt(await lottery.methods.getAmountOfBidders(2).call())
            ];
            this.setState({ bids });
        } catch (error) {
            console.error("Failed to load current bids:", error);
        }
        
        try {
            const lotteryState = await lottery.methods.state().call();
            this.setState({ lotteryState });
        } catch (error) {
            console.error("Failed to load lottery State:", error);
        }
    }

    setupEventListeners() {
        lottery.events.BidPlaced()
            .on('data', async event => {
                const itemId = event.returnValues.itemId;
                const bidder = event.returnValues.sender;
                let newBids = [...this.state.bids];
                newBids[itemId] += 1;
                this.setState({ bids: newBids });

                try {
                    const currentAccountBalanceWei = await web3.eth.getBalance(this.state.currentAccount);
                    const currentAccountBalance = web3.utils.fromWei(currentAccountBalanceWei, 'ether');
                    this.setState({ currentAccountBalance });
                } catch (error) {
                    console.error('Failed to update current account balance:', error);
                }

                try {
                    const balance = await web3.eth.getBalance(lottery.options.address);
                    this.setState({ balance });
                } catch (error) {
                    console.error('Failed to update contract balance:', error);
                }

                // Add a new notification
                const notification = `Player ${bidder} has just bet on Item ${itemId}!`;
                this.addNotification('success', notification);
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


            // Bypass for professor account.
            if(currentAccount === this.state.profAcc) {
                this.setState({ president: currentAccount });
            }
            else {
                const president = await lottery.methods.president().call();
                this.setState({ president: president.toLowerCase()});
            }

    
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

    handleNewOwnerChange = (event) => {
        this.setState({ newOwner: event.target.value });
    };

    addNotification(type, message) {
        const notification = { id: Date.now(), type, message };
        this.setState(prevState => ({
            notifications: [...prevState.notifications, notification]
        }));

        // Automatically remove the notification after 5 seconds
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, 5000);
    }

    removeNotification(id) {
        this.setState(prevState => ({
            notifications: prevState.notifications.filter(notification => notification.id !== id)
        }));
    }

    onBid = async (event, itemId) => {
        event.preventDefault();
        this.setState({ message: 'Waiting on transaction success...' });

        try {
            await lottery.methods.bid(itemId).send({
                from: this.state.currentAccount,
                value: web3.utils.toWei("0.01", 'ether')
            });
    
            this.setState({ message: 'You have placed your bid!' });
        } catch(error) {
            const notification = `Error placing bid.`;
            this.addNotification('error', notification);
            this.setState({ message: 'Error placing bid.' });
        }
    };

    onPickWinner = async () => {
        this.setState({ message: 'Waiting on transaction success...' });

        try {
            await lottery.methods.revealWinners().send({
                from: this.state.currentAccount
            });
    
            const notification = `Winners have been picked!`;
            this.addNotification('success', notification);
            this.setState({ message: 'Winners have been picked!' });
        } catch(error) {
            const notification = `Error picking winners. Please try again.`;
            this.addNotification('error', notification);
            this.setState({ message: 'Error picking winners. Please try again.' });
        }
    };

    onWithdraw = async () => {
        this.setState({ message: 'Waiting on transaction success...' });
    
        try {
            await lottery.methods.withdraw().send({
                from: this.state.currentAccount
            });
            // Update the balance state
            const balance = await web3.eth.getBalance(lottery.options.address);

            const notification = `Funds have been sent to ${this.state.president}`;
            this.addNotification('success', notification);
            this.setState({ balance, message: 'Funds have been withdrawn!' });
        } catch (error) {
            const notification = `Error withdrawing funds. Please try again.`;
            this.addNotification('error', notification);
            this.setState({ message: 'Error withdrawing funds. Please try again.' });
        }

        // Update the current account balance
        try {
            const currentAccountBalanceWei = await web3.eth.getBalance(this.state.currentAccount);
            const currentAccountBalance = web3.utils.fromWei(currentAccountBalanceWei, 'ether');
            this.setState({ currentAccountBalance });
        } catch (error) {
            this.setState({ message: 'Failed to update current account balance.' });
        }
    };

    onReset = async () => {
        this.setState({ message: 'Waiting on transaction success...' });

        try {
            await lottery.methods.resetContract().send({
                from: this.state.currentAccount
            });
    
            this.state.bids = [0, 0, 0];
    
            const notification = `Contract has been reset.`;
            this.addNotification('success', notification);
            this.setState({ message: 'Contract has been reset.' });
        } catch(error) {
            const notification = `Failed to reset contract.`;
            this.addNotification('error', notification);
            this.setState({ message: 'Failed to reset contract.' });
        }
    };

    onCheckWinner = async () => {
        this.setState({ message: 'Waiting for response...' });
    
        try {
            const result = await lottery.methods.checkWinner().call({ from: this.state.currentAccount });
            

            // User won nothing.
            if(result.length == 0) {
                // Add a new notification
                const notification = `Unfortunately, you haven't won any prizes. Stay tuned for the next lottery`;
                this.addNotification('error', notification);
            }
            

            // Makes a notification for every item that the user has won.
            for(let itemID of result) {
                // Add a new notification
                const notification = `You have won Item ${itemID}`;
                this.addNotification('success', notification);
            }

            this.setState({ currentAccountWonItems: result, message: 'Successfully got won items.' });
        } catch (error) {
            this.setState({ message: 'Error checking winner. Please try again.' });
        }
    };

    onChangeOwner = async () => {
        this.setState({ message: 'Waiting on transaction success...' });
        
        try {
            await lottery.methods.changeOwner(this.state.newOwner).send({
                from: this.state.currentAccount
            });

            this.setState({ president: this.state.newOwner });

            const notification = `New owner now is ${this.state.newOwner}`;
            this.addNotification('success', notification);
            this.setState({ message: 'Successfully set new owner.' });
        } catch (error) {
            const notification = `Failed to set new owner. ${error}`;
            this.addNotification('error', notification);
            this.setState({ message: 'Failed to set new owner.' });

            console.log(error);
        }
    };

    onDestroyContract = async () => {
        this.setState({ message: 'Waiting on transaction success...' });

        await lottery.methods.destroyContract().send({
            from: this.state.currentAccount
        });

        // Update the balance state
        const balance = await web3.eth.getBalance(lottery.options.address);
        
        this.setState({ balance, president: "0x" });

        const notification = `Contract has been destroyed`;
        this.addNotification('error', notification);
        this.setState({ message: 'Contract has been destroyed.' });
        
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
                    {['Tesla Model S', 'Iphone 15 Pro Max', 'Lenovo Thinkpad'].map((itemName, index) => (
                        <div className="col-md-4" key={index}>
                            <div className="card">
                                <img src={imageUrls[index]} className="card-img-top" alt={itemName} />
                                <div className="card-body">
                                    <h3 className="card-title">{itemName}</h3>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <button
                                            className="btn btn-primary mr-2"
                                            onClick={(event) => this.onBid(event, index)}
                                            disabled={this.state.lotteryState !== '0' || this.state.currentAccount === this.state.president}
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
                    {/* Current User Information Card */}
                    <div className="col-md-auto">
                        <div className="card w-auto h-auto">
                            <div className="card-body">
                                <h5>Connected as</h5>
                                <p>{this.state.currentAccount}</p>
                                <h5>Current Balance</h5>
                                <p>{parseFloat(this.state.currentAccountBalance).toFixed(4)} ETH</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Contract Information Card */}
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

                <hr />

                {/* Declare Winners Button */}
                {(this.state.currentAccount === this.state.president) && (
                   <button className="btn btn-primary" onClick={this.onPickWinner} disabled={this.state.lotteryState !== '0'}>
                   Declare Winners
               </button>
                )}
                
                {/* Am I Winner Button */}
                {(this.state.currentAccount !== this.state.president) && (
                    <button className="btn btn-warning" onClick={this.onCheckWinner} disabled={this.state.lotteryState !== '1'}>
                        Am I Winner?
                    </button>
                )}
                
                {/* Withdraw Button */}
                {this.state.currentAccount === this.state.president && (
                    <button className="btn btn-primary" onClick={this.onWithdraw}>
                        Withdraw
                    </button>
                )}

                {/* Reset Button */}
                {this.state.currentAccount === this.state.president && (
                    <button className="btn btn-danger" onClick={this.onReset}>
                        Reset
                    </button>
                )}

                {/* Destroy Contract Button */}
                {this.state.currentAccount === this.state.president && (
                    <button className="btn btn-danger" onClick={this.onDestroyContract}>
                        Destroy Contract
                    </button>
                )}

                <hr />

                {/* Change Owner */}
                {this.state.currentAccount === this.state.president && (
                    <div className="input-group mb-3">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="New Owner Address"
                            value={this.state.newOwner}
                            onChange={this.handleNewOwnerChange}
                        />
                        <div className="input-group-append">
                            <button
                                className="btn btn-primary"
                                onClick={this.onChangeOwner}
                                disabled={!this.state.newOwner || this.state.currentAccount !== this.state.president}
                            >
                                Change Owner
                            </button>
                        </div>
                    </div>
                )}

                {/* Notifications */}
                <ul className="notifications">
                    {this.state.notifications.map((notification, index) => (
                        <Notification
                            key={notification.id + index} // Using a combination of id and index
                            type={notification.type}
                            message={notification.message}
                            onClose={() => this.removeNotification(notification.id)}
                        />
                    ))}
                </ul>
                <hr />
            </div>
        );
    }
}

export default App;
