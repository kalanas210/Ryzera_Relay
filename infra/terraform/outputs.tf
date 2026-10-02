output "public_ip" {
  value = aws_eip.relay.public_ip
}

output "ssh" {
  value = "ssh -i ~/.ssh/relay_aws_ed25519 ubuntu@${aws_eip.relay.public_ip}"
}

output "dns_records" {
  description = "Add these at the domain's DNS host."
  value = [
    "A  @    ${aws_eip.relay.public_ip}",
    "A  www  ${aws_eip.relay.public_ip}",
  ]
}
