pragma solidity ^0.4.24;

contract Deal {

address public creator;
address public buyer;

uint timer = 30;

struct Order {
    string game;
    uint price;
    uint date;

    bool confirmed;
    bool paid;
    uint refundDeadline;
}

mapping (uint => Order) orders;
uint orderseq;

event OrderSent (string game, uint orderno, uint time);
event OrderConfirmed (string game, uint price, uint orderno, uint time);
event PaymentReceived (uint orderno, uint price, uint time);
event CountdownStarted (uint orderno, uint start, uint end);
event CountdownEnded (uint orderno, uint time);
event RefundSuccessful (uint orderno, address buyer, uint time);
event PayoutSuccessful (uint orderno, address creator, uint amount, uint time);
event OrderSuccessful (uint orderno, uint time);

function Deal (address buyerAddr) public {
    
    /// The seller is the contract's owner
    creator = msg.sender;

    buyer = buyerAddr;
  }

function sendOrder(string game) external  {
    
    /// Accept orders just from buyer
    require(msg.sender == buyer, "Only buyer can send an order");

    /// Increment the order sequence
    orderseq++;

    /// Create the order register
    orders[orderseq] = Order(game, 0, block.timestamp, false, false, 0);

    /// Trigger the event
    emit OrderSent(game, orderseq, block.timestamp);
  }

  function ConfirmOrder(uint orderno, uint price) public {

    require(msg.sender == creator, "Only creator can confirm an order");

    require(bytes(orders[orderno].game).length != 0, "Order does not exist");

    orders[orderno].price = price;
    orders[orderno].confirmed = true;

    emit OrderConfirmed(orders[orderno].game, price, orderno, block.timestamp);
  }

  function SendPayment(uint orderno) payable public {

    /// Just the buyer can make safepay
    require(buyer == msg.sender, "Only buyer can send a payment");

    require(orders[orderno].confirmed == true, "Order must be confirmed by the creator in order to be paid");

    require(orders[orderno].paid == false, "Order was already paid for");

    require(orders[orderno].price == msg.value, "Send the exact price");

    orders[orderno].paid = true;

    emit PaymentReceived(orderno, msg.value, block.timestamp);

    orders[orderno].refundDeadline = block.timestamp + timer;

    emit CountdownStarted(orderno, block.timestamp, block.timestamp + timer);
  }

  function ReturnProduct(uint orderno) public {

    require(msg.sender == buyer, "Only buyer can refund");
    require(orders[orderno].paid, "Order not paid");
    require(orders[orderno].refundDeadline >= block.timestamp, "Cannot refund after the deadline");

    uint amount = orders[orderno].price;
    orders[orderno].paid = false;

    buyer.transfer(amount);


    emit RefundSuccessful(orderno, buyer, block.timestamp);
  }

  function Payout(uint orderno) public {

    require(msg.sender == creator, "Only creator can get the payout");
    require(orders[orderno].paid, "Order must be paid in order to receive the payout");
    require(orders[orderno].refundDeadline <= block.timestamp, "Cannot receive the payout before the deadline");

    uint amount = orders[orderno].price;
    orders[orderno].paid = false;

    creator.transfer(amount);


    emit PayoutSuccessful(orderno, creator, amount, block.timestamp);
    emit OrderSuccessful(orderno, block.timestamp);
  }

  function getName(uint orderno) public view returns (string) {
    return orders[orderno].game;
}

  function getPrice(uint orderno) public view returns (uint) {
    return orders[orderno].price;
}

function getRefundWindow(uint orderno) public view returns (uint) {
    Order storage o = orders[orderno];

    if (!o.paid) {
        return 0; // or return a sentinel value you choose
    }

    if (block.timestamp >= o.refundDeadline) {
        return 0; // no time left
    }

    return o.refundDeadline - block.timestamp;
}

}