async function seedData() {
  const res = await fetch("/api/seed");
  const data = await res.json();
  alert(data.message);
  loadEvents();
}

function showAddEventForm() {
  document.getElementById("addEventForm").classList.toggle("hidden");
}

async function createEvent() {
  const name = document.getElementById("eventName").value.trim();
  const event_date = document.getElementById("eventDate").value.trim();
  const venue = document.getElementById("eventVenue").value.trim();
  const seats = document.getElementById("eventSeats").value
    .split(",")
    .map(s => s.trim())
    .filter(s => s);

  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, event_date, venue, seats })
  });

  const data = await res.json();
  if (data.success) {
    alert("Event created");
    loadEvents();
    document.getElementById("addEventForm").classList.add("hidden");
  } else {
    alert(data.error || "Failed to create event");
  }
}

async function loadEvents() {
  const res = await fetch("/api/events");
  const events = await res.json();

  const container = document.getElementById("events");
  if (!container) return;

  container.innerHTML = "";

  if (events.length === 0) {
    container.innerHTML = "<p>No events found. Click 'Load Sample Data'.</p>";
    return;
  }

  events.forEach((event) => {
    const div = document.createElement("div");
    div.className = "event-card";
    div.innerHTML = `
      <h3>${event.name}</h3>
      <p>Date: ${event.event_date}</p>
      <p>Venue: ${event.venue}</p>
      <button onclick="viewSeats(${event.id}, '${event.name}', '${event.event_date}', '${event.venue}')">View Seats</button>
    `;
    container.appendChild(div);
  });
}

async function viewSeats(eventId, name, date, venue) {
  const res = await fetch(`/api/events/${eventId}/seats`);
  const seats = await res.json();

  localStorage.setItem("selectedEventId", eventId);
  localStorage.setItem("selectedEventInfo", JSON.stringify({ name, date, venue }));
  localStorage.setItem("selectedSeats", JSON.stringify(seats));

  window.location.href = "booking.html";
}

function goBack() {
  window.location.href = "index.html";
}

window.onload = () => {
  if (document.getElementById("events")) {
    loadEvents();
  }

  if (document.getElementById("seats")) {
    renderSeats();
  }
};

function renderSeats() {
  const seats = JSON.parse(localStorage.getItem("selectedSeats") || "[]");
  const eventId = localStorage.getItem("selectedEventId");
  const eventInfo = JSON.parse(localStorage.getItem("selectedEventInfo") || "{}");

  document.getElementById("eventId").value = eventId;
  document.getElementById("eventInfo").innerText =
    `${eventInfo.name || ""} | ${eventInfo.date || ""} | ${eventInfo.venue || ""}`;

  const seatContainer = document.getElementById("seats");
  seatContainer.innerHTML = "";

  seats.forEach((seat) => {
    const div = document.createElement("div");
    div.className = `seat ${seat.status}`;
    div.innerHTML = `
      <strong>${seat.seat_number}</strong><br/>
      <small>${seat.status}</small><br/>
      ${seat.status === "available" ? `<button onclick="selectSeat(${seat.id}, this)">Select</button>` : ""}
    `;
    seatContainer.appendChild(div);
  });
}

function selectSeat(seatId, btn) {
  document.getElementById("seatId").value = seatId;
  document.querySelectorAll(".seat").forEach((el) => el.classList.remove("selected"));
  btn.parentElement.classList.add("selected");
}

async function bookSeat() {
  const event_id = document.getElementById("eventId").value;
  const seat_id = document.getElementById("seatId").value;
  const customer_name = document.getElementById("customerName").value.trim();
  const customer_phone = document.getElementById("customerPhone").value.trim();

  if (!seat_id) {
    alert("Please select a seat first");
    return;
  }

  if (!customer_name) {
    alert("Please enter your name");
    return;
  }

  const res = await fetch("/api/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id, seat_id, customer_name, customer_phone })
  });

  const data = await res.json();

  if (data.success) {
    alert("Booking successful!");
    const seatRes = await fetch(`/api/events/${event_id}/seats`);
    const refreshedSeats = await seatRes.json();
    localStorage.setItem("selectedSeats", JSON.stringify(refreshedSeats));
    renderSeats();
    document.getElementById("seatId").value = "";
  } else {
    alert(data.error || "Booking failed");
  }
}
