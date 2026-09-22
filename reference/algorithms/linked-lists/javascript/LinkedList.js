function Node(val) {
    this.data = val;
    this.prev = null;
    this.next = null;
}

function LinkedList() {
    this.head = null;
    this.tail = null;
    
    this.addAtFront = function (val) {
        if (this.head === null) {  //If first node
            this.head = new Node(val);
            this.tail = this.head;
        } else {
            var temp = new Node(val);
            temp.next = this.head;
            this.head.prev = temp;
            this.head = temp;
        }
    };
    
    this.addAtEnd = function (val) {
        if (this.tail === null) {  //If first node
            this.tail = new Node(val);
            this.head = this.tail;
        } else {
            var temp = new Node(val);
            temp.prev = this.tail;
            this.tail.next = temp;
            this.tail = temp;
        }
    };
    
    this.removeAtHead = function () {
        var toReturn = null;
        
        if (this.head !== null) {
            toReturn = this.head.data;
           
            if (this.tail === this.head) {
                this.head = null;
                this.tail = null;
            } else {
                this.head = this.head.next;
                this.head.prev = null;
            }
        }
        return toReturn;
    };
    
    this.removeAtTail = function () {
        var toReturn = null;
        
        if (this.tail !== null) {
            toReturn = this.tail.data;
           
            if (this.tail === this.head) {
                this.head = null;
                this.tail = null;
            } else {
                this.tail = this.tail.prev;
                this.tail.next = null;
            }
        }
            
        return toReturn;
    };
    
    this.each = function (f) {
        var curr = this.head;
        while (curr !== null) {
            f(curr);
            curr = curr.next;
        }
    };
    
    this.printList = function () {
        this.each(function (item) {
            console.log(item.data);
        });
    };
}
    


var testList = new LinkedList();

var runTests = function () {
    testList.addAtFront("Second");
    testList.addAtFront("First");
    testList.addAtEnd("Third");
    testList.addAtEnd("Fourth");
    
    testList.printList();
    
    testList.removeAtHead();
    testList.removeAtTail();
    
    testList.printList();
    
    testList.removeAtHead();
    testList.removeAtHead();
    
    testList.printList();

};
    
                    

