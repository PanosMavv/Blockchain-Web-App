import React, { Component } from 'react';
import './Notification.css';

class Notification extends Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: true
        };
    }

    componentDidMount() {
        setTimeout(() => {
            this.setState({ visible: false });
        }, 4500);
    }

    render() {
        const { visible } = this.state;
        const { type, message } = this.props;

        return (
            <li className={`notification ${type} ${visible ? 'show' : 'hide'}`}>
                <p>{message}</p>
            </li>
        );
    }
}

export default Notification;