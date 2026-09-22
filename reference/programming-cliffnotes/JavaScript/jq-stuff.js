// jQuery examples
// jQuery is not required for modern vanilla JavaScript, but you may still see it
// in older projects. These examples show common legacy patterns.

$(function () {
  // Runs when the document is ready.

  // Select by element, class, or id. jQuery uses CSS selector syntax.
  $("h1");
  $(".myClass");
  $("#myId");

  $("h1").text("This header was changed by jQuery");

  // You can also find elements by traversing.
  $("#myList").find("li"); // Same as $("#myList li")
  $("#myList").children("li"); // Same as $("#myList > li")
  $("#myList").find("li").first().next(); // Second list item
  $("#myList").find("li").first().parent(); // The #myList ul
  $("#myList").closest(".text"); // First ancestor with that class

  $(".class1").filter(".class2"); // Everything with class1 AND class2

  // Register event listeners.
  $("#jQuery").on("click", function () {
    console.log("jQuery button pushed");
  });

  // Add content.
  $("#mainParagraph").before("Before "); // Before sibling
  $("#mainParagraph").after("After "); // After sibling
  $("#mainParagraph").prepend("Prepend "); // First child
  $("#mainParagraph").append("Append "); // Last child

  // Add classes.
  $("#mainParagraph").addClass("jqueryclass");
  $("li").addClass("liclass");

  $("#clickToShow").on("click", function () {
    $("#slideout").slideToggle();
    $("#fadein").fadeToggle();
  });

  // There are many other mouse and keyboard events, like mouseenter, mouseleave,
  // keydown, and keyup.
  $("h2").on("click", function () {
    $(this).text("Clicked!");
  });

  // Other common jQuery patterns:
  // const price = Number($(this).data("price")); // Convert data-price to a number
  // const quantity = Number($(this).val()); // Convert a field value to a number
  // $(this).css({ color: "red" }); // Add a CSS rule
  // $(this).toggleClass("active"); // Add/remove a CSS class
  // $(this).animate({ opacity: 0.5 }, 300); // Animate over 300ms
});
